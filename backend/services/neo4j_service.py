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
            # Retry connection logic (wait for Neo4j to start)
            import time
            max_retries = 15
            for i in range(max_retries):
                try:
                    self.verify_connection()
                    break
                except Exception as e:
                    if i < max_retries - 1:
                        logger.info(f"Neo4j not ready yet, retrying in 2s... ({i+1}/{max_retries})")
                        time.sleep(2)
                    else:
                        raise e
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j: {e}")
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
            logger.info("Connected to Neo4j successfully.")

    def insert_nodes(self, nodes):
        """
        Insert a list of nodes into Neo4j.
        Each node dict should have: id, type, label, description, importance
        """
        if not self.driver:
            logger.warning("Neo4j driver not initialized. Skipping insert_nodes.")
            return

        query = """
        UNWIND $nodes AS node
        MERGE (n:Node {id: node.id})
        SET n.label = node.label,
            n.type = node.type,
            n.description = node.description,
            n.importance = node.importance,
            n.depth = node.depth
        """
        
        try:
            with self.driver.session() as session:
                session.run(query, nodes=nodes)
            logger.info(f"Inserted {len(nodes)} nodes into Neo4j.")
        except Exception as e:
            logger.error(f"Error inserting nodes: {e}")

    def insert_relationships(self, edges):
        """
        Insert a list of edges into Neo4j.
        Each edge dict should have: source, target, relation
        """
        if not self.driver:
            logger.warning("Neo4j driver not initialized. Skipping insert_relationships.")
            return

        query = """
        UNWIND $edges AS edge
        MATCH (s:Node {id: edge.source})
        MATCH (t:Node {id: edge.target})
        MERGE (s)-[r:RELATION {type: edge.relation}]->(t)
        SET r.label = edge.relation
        """
        
        try:
            with self.driver.session() as session:
                session.run(query, edges=edges)
            logger.info(f"Inserted {len(edges)} relationships into Neo4j.")
        except Exception as e:
            logger.error(f"Error inserting relationships: {e}")

    def get_subgraph(self, limit=100):
        """
        Fetch a subgraph (nodes and edges) from Neo4j.
        """
        if not self.driver:
            logger.warning("Neo4j driver not initialized. Skipping get_subgraph.")
            return {"nodes": [], "edges": []}

        query = """
        MATCH (n)-[r]->(m)
        RETURN n, r, m
        LIMIT $limit
        """
        
        nodes = {}
        edges = []

        try:
            with self.driver.session() as session:
                result = session.run(query, limit=limit)
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

    def get_subgraph_by_ids(self, node_ids: list):
        """
        Fetch all nodes in the ID list and any relationships within them.
        """
        if not self.driver or not node_ids:
            return {"nodes": [], "edges": []}

        query = """
        MATCH (n) WHERE n.id IN $node_ids
        OPTIONAL MATCH (n)-[r]-(m) WHERE m.id IN $node_ids
        RETURN DISTINCT n, r, m
        """
        
        nodes = {}
        edges = []
        processed_edges = set()

        try:
            with self.driver.session() as session:
                result = session.run(query, node_ids=node_ids)
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
