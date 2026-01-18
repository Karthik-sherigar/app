import requests
import sys
import json
import io
from datetime import datetime

class KnowledgeGraphAPITester:
    def __init__(self, base_url="https://graphai.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, timeout=60)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=60)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if 'nodes' in response_data:
                        print(f"   Graph nodes: {len(response_data['nodes'])}")
                    if 'edges' in response_data:
                        print(f"   Graph edges: {len(response_data['edges'])}")
                except:
                    pass
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")

            return success, response.json() if success and response.content else {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout (30s)")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test backend health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        return success

    def test_query_mode_graph_generation(self):
        """Test query mode graph generation"""
        success, response = self.run_test(
            "Query Mode - Generate Graph",
            "POST",
            "generate-graph",
            200,
            data={
                "query": "Explain machine learning algorithms",
                "mode": "query"
            }
        )
        
        if success and response:
            # Validate response structure
            if 'nodes' in response and 'edges' in response:
                nodes_count = len(response['nodes'])
                edges_count = len(response['edges'])
                print(f"   Generated {nodes_count} nodes and {edges_count} edges")
                
                # Check if nodes have required fields
                if nodes_count > 0:
                    sample_node = response['nodes'][0]
                    required_fields = ['id', 'label', 'type']
                    missing_fields = [field for field in required_fields if field not in sample_node]
                    if missing_fields:
                        print(f"   ⚠️  Missing node fields: {missing_fields}")
                    else:
                        print(f"   ✅ Node structure valid")
                
                # Check node count is in expected range (15-25)
                if 15 <= nodes_count <= 25:
                    print(f"   ✅ Node count in expected range (15-25)")
                else:
                    print(f"   ⚠️  Node count {nodes_count} outside expected range (15-25)")
                    
                return True, response
            else:
                print(f"   ❌ Invalid response structure - missing nodes/edges")
                return False, {}
        
        return success, response

    def test_programming_mode_graph_generation(self):
        """Test programming mode graph generation"""
        code_sample = """
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

def main():
    for i in range(10):
        print(f"fib({i}) = {fibonacci(i)}")

if __name__ == "__main__":
    main()
"""
        
        success, response = self.run_test(
            "Programming Mode - Generate Graph",
            "POST",
            "generate-graph",
            200,
            data={
                "query": code_sample,
                "mode": "programming"
            }
        )
        
        if success and response:
            nodes_count = len(response.get('nodes', []))
            if 10 <= nodes_count <= 20:
                print(f"   ✅ Programming graph node count appropriate ({nodes_count})")
            else:
                print(f"   ⚠️  Programming graph node count {nodes_count} outside expected range (10-20)")
        
        return success, response

    def test_pdf_mode_graph_generation(self):
        """Test PDF mode graph generation with a simple PDF"""
        # Create a simple PDF-like content for testing
        # Note: This is a mock test since we can't easily create a real PDF in this context
        print("\n🔍 Testing PDF Mode - Generate Graph...")
        print("   ⚠️  Skipping PDF test - requires actual PDF file upload")
        print("   📝 Manual test required: Upload a PDF through the UI")
        return True, {}

    def test_expand_node(self):
        """Test node expansion functionality"""
        # First generate a graph to get nodes
        success, graph_data = self.test_query_mode_graph_generation()
        
        if not success or not graph_data.get('nodes'):
            print("   ❌ Cannot test expand node - no graph data available")
            return False, {}
        
        # Get first node for expansion
        first_node = graph_data['nodes'][0]
        
        success, response = self.run_test(
            "Expand Node",
            "POST",
            "expand-node",
            200,
            data={
                "node_id": first_node['id'],
                "node_label": first_node['label'],
                "current_graph": graph_data
            }
        )
        
        if success and response:
            new_nodes = len(response.get('nodes', []))
            new_edges = len(response.get('edges', []))
            if 5 <= new_nodes <= 8:
                print(f"   ✅ Expansion generated appropriate nodes ({new_nodes})")
            else:
                print(f"   ⚠️  Expansion generated {new_nodes} nodes, expected 5-8")
        
        return success, response

    def test_explain_confusion(self):
        """Test explanation functionality"""
        success, response = self.run_test(
            "Explain Confusion",
            "POST",
            "explain-confusion",
            200,
            data={
                "topic": "Machine Learning",
                "confusion": "How does gradient descent work?"
            }
        )
        
        if success and response:
            required_fields = ['simple', 'analogy', 'steps']
            missing_fields = [field for field in required_fields if field not in response]
            if missing_fields:
                print(f"   ❌ Missing explanation fields: {missing_fields}")
            else:
                print(f"   ✅ Explanation structure valid")
                print(f"   Simple: {response.get('simple', '')[:50]}...")
        
        return success, response

    def test_history_endpoint(self):
        """Test history retrieval"""
        success, response = self.run_test(
            "Get History",
            "GET",
            "history",
            200
        )
        
        if success:
            history_count = len(response) if isinstance(response, list) else 0
            print(f"   History items: {history_count}")
        
        return success, response

def main():
    print("🚀 Starting Knowledge Graph API Testing")
    print("=" * 50)
    
    # Setup
    tester = KnowledgeGraphAPITester()
    
    # Run tests in order
    tests = [
        tester.test_health_check,
        tester.test_query_mode_graph_generation,
        tester.test_programming_mode_graph_generation,
        tester.test_expand_node,
        tester.test_explain_confusion,
        tester.test_history_endpoint,
        tester.test_pdf_mode_graph_generation,  # Last since it's manual
    ]
    
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
            tester.tests_run += 1
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Tests completed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())