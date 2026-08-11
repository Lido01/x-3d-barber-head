import os
from dotenv import load_dotenv
from typing import Annotated, TypedDict
from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition

# Import local tools and provider
from src.tools.calendar_tools import check_availability, book_appointment

load_dotenv()

# 1. Register tools
tools = [check_availability, book_appointment]

# 2. Select LLM Model
if os.getenv("LLM_PROVIDER") == "groq":
    from langchain_groq import ChatGroq
    llm = ChatGroq(model="llama-3.3-70b-versatile").bind_tools(tools)
else:
    from langchain_ollama import ChatOllama
    llm = ChatOllama(model=os.getenv("OLLAMA_MODEL", "llama3.2")).bind_tools(tools)

# 3. Define State
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

# 4. Define Nodes
def chatbot_node(state: AgentState):
    response = llm.invoke(state["messages"])
    return {"messages": [response]}

# 5. Build Graph
builder = StateGraph(AgentState)
builder.add_node("chatbot", chatbot_node)
builder.add_node("tools", ToolNode(tools))

# Flow: START -> Chatbot -> (Should call tool?) -> Yes: Tools -> Chatbot / No: END
builder.add_edge(START, "chatbot")
builder.add_conditional_edges("chatbot", tools_condition)
builder.add_edge("tools", "chatbot")

agent_graph = builder.compile()