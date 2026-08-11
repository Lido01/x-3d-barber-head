from src.database.models import init_db
from src.agent.graph import agent_graph
from langchain_core.messages import HumanMessage

def run():
    # Ensure database exists
    init_db()
    print("--- Barber Autonomous Agent Online ---")
    print("Type 'exit' to quit.\n")
    
    history = []

    while True:
        user_input = input("You: ")
        if user_input.lower() in ["exit", "quit"]:
            break

        history.append(HumanMessage(content=user_input))
        
        # Stream execution states
        events = agent_graph.stream({"messages": history}, stream_mode="values")
        
        for event in events:
            latest_msg = event["messages"][-1]
            if latest_msg.type == "ai" and latest_msg.content:
                print(f"\nAgent: {latest_msg.content}\n")
                history = event["messages"]

if __name__ == "__main__":
    run()