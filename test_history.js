async function test() {
  try {
    console.log("Fetching history...");
    const res = await fetch('http://localhost:8000/api/history?limit=1');
    const firstItem = (await res.json())[0];
    const historyId = firstItem.id;
    console.log("Got history ID:", historyId);
    
    console.log("Fetching full detail...");
    const detail = await fetch(`http://localhost:8000/api/history/${historyId}`);
    const detailJson = await detail.json();
    let data = detailJson.response_data;
    console.log("Current exploration stack size:", data.explorationStack ? data.explorationStack.length : 0);
    
    data.explorationStack = [{nodeId: 'test_node', chatHistory: [{role: 'user', content: 'hello'}]}];
    console.log("Updating...");
    await fetch(`http://localhost:8000/api/history/${historyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    console.log("Fetching detail again to verify...");
    const detail2 = await fetch(`http://localhost:8000/api/history/${historyId}`);
    const stack2 = (await detail2.json()).response_data.explorationStack;
    console.log("New stack size:", stack2 ? stack2.length : 0);
    console.log("Content:", JSON.stringify(stack2));
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
