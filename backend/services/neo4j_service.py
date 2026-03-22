import os
from neo4j import GraphDatabase
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Neo4jService:
    def __init__(self):
        # Default fallback to localhost if env vars are missing
        uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        user = os.getenv("NEO4J_USER", "neo4j")
        password = os.getenv("NEO4J_PASSWORD", "password")
        
        try:
            self.driver = GraphDatabase.driver(uri, auth=(user, password))
            # Just try once and don't block. The rest of the app will work.
            try:
                self.verify_connection()
            except Exception:
                logger.warning("Neo4j not ready at startup. Will continue without it.")
        except Exception as e:
            logger.error(f"Failed to initialize Neo4j driver: {e}")
            self.driver = None

    def close(self):
        if self.driver:
            self.driver.close()

    def verify_connection(self):
        if self.driver:
            self.driver.verify_connectivity()
            # Create Index on id property to avoid warnings
            with self.driver.session() as session:
                session.run("CREATE INDEX node_id_index IF NOT EXISTS FOR (n:Node) ON (n.id)")
                session.run("CREATE INDEX node_mode_index IF NOT EXISTS FOR (n:Node) ON (n.mode)")
            logger.info("Connected to Neo4j successfully.")

    def insert_nodes(self, nodes, mode="query"):
        """
        Insert a list of nodes into Neo4j with mode isolation.
        Each node dict should have: id, type, label, description, importance
        """
        if not self.driver:
            logger.warning("Neo4j driver not initialized. Skipping insert_nodes.")
            return

        # Dynamically inject mode label for isolation
        query = f"""
        UNWIND $nodes AS node
        MERGE (n:Node:{mode.capitalize()} {{id: node.id}})
        SET n.label = node.label,
            n.type = node.type,
            n.description = node.description,
            n.importance = node.importance,
            n.depth = node.depth,
            n.mode = $mode
        """
        
        try:
            with self.driver.session() as session:
                session.run(query, nodes=nodes, mode=mode)
            logger.info(f"Inserted {len(nodes)} nodes into Neo4j (mode={mode}).")
        except Exception as e:
            logger.error(f"Error inserting nodes: {e}")

    def insert_relationships(self, edges, mode="query"):
        """
        Insert a list of edges into Neo4j with mode isolation.
        Each edge dict should have: source, target, relation
        """
        if not self.driver:
            logger.warning("Neo4j driver not initialized. Skipping insert_relationships.")
            return

        query = f"""
        UNWIND $edges AS edge
        MATCH (s:Node:{mode.capitalize()} {{id: edge.source}})
        MATCH (t:Node:{mode.capitalize()} {{id: edge.target}})
        MERGE (s)-[r:RELATION {{type: edge.relation}}]->(t)
        SET r.label = edge.relation,
            r.mode = $mode
        """
        
        try:
            with self.driver.session() as session:
                session.run(query, edges=edges, mode=mode)
            logger.info(f"Inserted {len(edges)} relationships into Neo4j (mode={mode}).")
        except Exception as e:
            logger.error(f"Error inserting relationships: {e}")

    def get_subgraph(self, limit=100, mode=None):
        """
        Fetch a subgraph (nodes and edges) from Neo4j, optionally filtered by mode.
        """
        if not self.driver:
            logger.warning("Neo4j driver not initialized. Skipping get_subgraph.")
            return {"nodes": [], "edges": []}

        label_filter = f":{mode.capitalize()}" if mode else ""
        query = f"""
        MATCH (n{label_filter})-[r]->(m{label_filter})
        {"WHERE n.mode = $mode AND m.mode = $mode" if mode else ""}
        RETURN n, r, m
        LIMIT $limit
        """
        
        nodes = {}
        edges = []

        try:
            with self.driver.session() as session:
                result = session.run(query, limit=limit, mode=mode)
                for record in result:
                    n = record["n"]
                    m = record["m"]
                    r = record["r"]
                    
                    if n["id"] not in nodes:
                        nodes[n["id"]] = {
                            "id": n["id"],
                            "label": n.get("label"),
                            "type": n.get("type"),
                            "description": n.get("description"),
                            "importance": n.get("importance"),
                            "depth": n.get("depth", 0)
                        }
                    
                    if m["id"] not in nodes:
                        nodes[m["id"]] = {
                            "id": m["id"],
                            "label": m.get("label"),
                            "type": m.get("type"),
                            "description": m.get("description"),
                            "importance": m.get("importance"),
                            "depth": m.get("depth", 0)
                        }

                    edges.append({
                        "source": n["id"],
                        "target": m["id"],
                        "relation": r.get("label", r.type)
                    })
            
            return {"nodes": list(nodes.values()), "edges": edges}
        
        except Exception as e:
            logger.error(f"Error fetching subgraph: {e}")
            return {"nodes": [], "edges": []}

    def get_subgraph_by_ids(self, node_ids: list, mode=None):
        """
        Fetch all nodes in the ID list and any relationships within them, optionally filtered by mode.
        """
        if not self.driver or not node_ids:
            return {"nodes": [], "edges": []}

        label_filter = f":{mode.capitalize()}" if mode else ""
        query = f"""
        MATCH (n{label_filter}) WHERE n.id IN $node_ids
        {"AND n.mode = $mode" if mode else ""}
        OPTIONAL MATCH (n)-[r]-(m{label_filter}) WHERE m.id IN $node_ids
        {"AND m.mode = $mode" if mode else ""}
        RETURN DISTINCT n, r, m
        """
        
        nodes = {}
        edges = []
        processed_edges = set()

        try:
            with self.driver.session() as session:
                result = session.run(query, node_ids=node_ids, mode=mode)
                for record in result:
                    n = record["n"]
                    if n:
                        nodes[n["id"]] = {
                            "id": n["id"],
                            "label": n.get("label"),
                            "type": n.get("type"),
                            "description": n.get("description"),
                            "importance": n.get("importance"),
                            "depth": n.get("depth", 0)
                        }
                    
                    m = record["m"]
                    if m and m["id"] in node_ids:
                        nodes[m["id"]] = {
                            "id": m["id"],
                            "label": m.get("label"),
                            "type": m.get("type"),
                            "description": m.get("description"),
                            "importance": m.get("importance"),
                            "depth": m.get("depth", 0)
                        }

                    r = record["r"]
                    if r:
                        # Ensure undirected edge check or simple source/target
                        # Neo4j result might return (n, r, m) in either direction
                        # But for us, we just need the relationship properties
                        edge_id = r.element_id if hasattr(r, 'element_id') else r.id
                        if edge_id not in processed_edges:
                            edges.append({
                                "source": r.start_node.get("id"), # This relies on node having 'id' property stored
                                "target": r.end_node.get("id"),
                                "relation": r.get("label", r.type)
                            })
                            processed_edges.add(edge_id)
            
            return {"nodes": list(nodes.values()), "edges": edges}
        
        except Exception as e:
            logger.error(f"Error fetching subgraph by ids: {e}")
            return {"nodes": [], "edges": []}

    def clear_mode_data(self, mode: str):
        """
        Exclusively clear data for a specific mode in Neo4j.
        """
        if not self.driver or not mode:
            return

        query = f"MATCH (n:Node:{mode.capitalize()}) DETACH DELETE n"
        try:
            with self.driver.session() as session:
                session.run(query)
            logger.info(f"Cleared all Neo4j data for mode: {mode}")
        except Exception as e:
            logger.error(f"Error clearing Neo4j mode data: {e}")
