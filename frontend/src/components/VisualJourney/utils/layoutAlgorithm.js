// Layout algorithm for vertical journey
export const calculateVerticalLayout = (nodes, edges) => {
    // Check if we have valid depth data
    const hasValidDepths = nodes.some(n => n.depth !== undefined && n.depth !== 0);

    let processedNodes = [...nodes];

    if (!hasValidDepths && nodes.length > 0) {
        // Fallback: Infer depth using BFS starting from nodes with no incoming edges
        const incomingEdgesCount = {};
        nodes.forEach(n => incomingEdgesCount[n.id] = 0);
        edges.forEach(e => {
            if (incomingEdgesCount[e.target] !== undefined) {
                incomingEdgesCount[e.target]++;
            }
        });

        const queue = [];
        nodes.forEach(n => {
            if (incomingEdgesCount[n.id] === 0) {
                queue.push({ id: n.id, depth: 0 });
            }
        });

        // If it's a cyclic graph or no clear roots, start with the first node
        if (queue.length === 0 && nodes.length > 0) {
            queue.push({ id: nodes[0].id, depth: 0 });
        }

        const depths = {};
        const visited = new Set();
        while (queue.length > 0) {
            const { id, depth } = queue.shift();

            // Prevent infinite loops and only keep the first (shortest) path depth
            if (visited.has(id)) continue;
            visited.add(id);

            depths[id] = depth;

            edges.filter(e => e.source === id).forEach(e => {
                if (!visited.has(e.target)) {
                    queue.push({ id: e.target, depth: depth + 1 });
                }
            });
        }

        processedNodes = nodes.map(n => ({
            ...n,
            depth: depths[n.id] !== undefined ? depths[n.id] : 0
        }));
    }

    // Group nodes by depth (hierarchical level)
    const nodesByDepth = {};
    const nodeMap = {};

    // Create node map
    processedNodes.forEach(node => {
        nodeMap[node.id] = { ...node, depth: node.depth || 0 };
        const depth = node.depth || 0;
        if (!nodesByDepth[depth]) {
            nodesByDepth[depth] = [];
        }
        nodesByDepth[depth].push(node.id);
    });

    // Calculate positions
    const layout = [];
    const depthKeys = Object.keys(nodesByDepth).sort((a, b) => parseInt(a) - parseInt(b));

    const CONTAINER_WIDTH = 1400;
    const VERTICAL_SPACING = 600;
    const HEADER_OFFSET = 300;

    depthKeys.forEach((depth, depthIndex) => {
        const nodesAtDepth = nodesByDepth[depth];
        const nodeCount = nodesAtDepth.length;
        const y = HEADER_OFFSET + parseInt(depth) * VERTICAL_SPACING;

        nodesAtDepth.forEach((nodeId, index) => {
            const node = nodeMap[nodeId];

            // Calculate X based on count and index
            // If 1 node: center
            // If multiple: spread them out across the width
            let x = CONTAINER_WIDTH / 2;
            if (nodeCount > 1) {
                const margin = 200;
                const availableWidth = CONTAINER_WIDTH - (margin * 2);
                x = margin + (index * (availableWidth / (nodeCount - 1)));
            }

            layout.push({
                ...node,
                position: {
                    x,
                    y,
                    depth: parseInt(depth),
                    index: index,
                    total: nodeCount
                }
            });
        });
    });

    return layout;
};

export const getConnectionsForNode = (nodeId, edges) => {
    return {
        incoming: edges.filter(e => e.target === nodeId),
        outgoing: edges.filter(e => e.source === nodeId)
    };
};
