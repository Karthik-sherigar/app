async function test() {
  try {
    const res = await fetch('http://localhost:8000/api/history?limit=3');
    const items = await res.json();
    for (const item of items) {
       console.log("ID:", item.id);
       const detail = await fetch(`http://localhost:8000/api/history/${item.id}`);
       const detailJson = await detail.json();
       const data = detailJson.response_data;
       console.log("  has explorationStack:", !!(data && data.explorationStack));
       if (data && data.explorationStack) {
           console.log("  stack size:", data.explorationStack.length);
       }
    }
  } catch (e) { console.error(e.message); }
}
test();
