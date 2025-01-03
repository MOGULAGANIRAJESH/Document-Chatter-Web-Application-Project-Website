from flask import Flask, request, render_template
from werkzeug.utils import secure_filename
import os
import io
from langchain_community.vectorstores.faiss import FAISS
from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
    UnstructuredPowerPointLoader,
    UnstructuredWordDocumentLoader,
)
from langchain_community.embeddings import HuggingFaceEmbeddings, VoyageEmbeddings
from langchain.text_splitter import CharacterTextSplitter
import os
from langchain_community.llms.replicate import Replicate
from langchain_community.llms.together import Together
from langchain.chains import ConversationalRetrievalChain
from langchain.prompts import (
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
    ChatPromptTemplate,
    PromptTemplate,
)
import json
from dotenv import load_dotenv

if not os.path.exists("storage"):
    os.makedirs("storage")

load_dotenv()

app = Flask(__name__)

# embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-base-en-v1.5")
embeddings = VoyageEmbeddings(
    voyage_api_key=os.getenv("VOYAGE_API_KEY"),
    show_progress_bar=True,
    batch_size=16,
)
llm = Replicate(
    model="meta/llama-2-7b-chat:13c3cdee13ee059ab779f0291d29054dab00a47dad8261375654de5540165fb0",
    input={"temperature": 0.4, "max_new_tokens": 800},
)
# llm = Together(model="mistralai/Mixtral-8x7B-Instruct-v0.1")
general_system_template = r"""You are a helpful assistant. Use the following context to answer the questions related to document.
You are given the following extracted parts of document and a question about it. Provide a direct answer without including any expressions of gratitude or personal phrases. 
Avoid generating answers that are not in the context and avoid generating responses that include expressions of gratitude such as 'Thank you for your question.' 
If you don't have information on a specific topic or the answer about the question is not present in given context, reply with 'Sorry, I don't have information about it.' Don't try to make up an answer from your knowledge base!.
If the question is not about the below given context, politely inform them that you are tuned to only answer questions about the document.

{context}

"""
general_user_template = "[INST] {question} [/INST]"
messages = [
    SystemMessagePromptTemplate.from_template(general_system_template),
    HumanMessagePromptTemplate.from_template(general_user_template),
]
qa_prompt = ChatPromptTemplate.from_messages(messages)

repharse_question_template = """[SYS] Given the following conversation and a follow up question, **rephrase** the follow up question to be a standalone question. Only give the standalone question without any other text. [/SYS]

Chat History:
{chat_history}

Follow Up Input: {question}

Standalone question:
"""


@app.route("/")
def home():
    return render_template("index.html")


def embed(files, userId):
    docs = []
    for file in files:
        filename = secure_filename(file.filename)
        extension = os.path.splitext(filename)[1]
        filename = "storage/" + userId + extension
        fileBytes = io.BytesIO(file.read())
        with open(filename, "wb") as f:
            f.write(fileBytes.getvalue())
        if extension == ".pdf":
            loader = PyPDFLoader(filename)
            documents = loader.load()
            textSplitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=0)
            docs.extend(textSplitter.split_documents(documents))
        elif extension == ".txt":
            loader = TextLoader(filename)
            documents = loader.load()
            textSplitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=0)
            docs.extend(textSplitter.split_documents(documents))
        elif extension == ".docx" or extension == ".doc":
            loader = UnstructuredWordDocumentLoader(filename, mode="paged")
            documents = loader.load()
            textSplitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=0)
            docs.extend(textSplitter.split_documents(documents))
        elif extension == ".ppt" or extension == ".pptx":
            loader = UnstructuredPowerPointLoader(filename, mode="paged")
            documents = loader.load()
            textSplitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=0)
            docs.extend(textSplitter.split_documents(documents))
    db = FAISS.from_documents(docs, embeddings)
    db.save_local("storage", index_name=userId)
    print("Embedding done!")


@app.route("/query", methods=["POST"])
def queryUser():
    data = request.get_json()
    query = data["query"]
    userId = data["userId"]
    chat_history = data["history"]
    chat_history = [(item["query"], item["answer"]) for item in chat_history]
    db = FAISS.load_local("storage", embeddings, userId, allow_dangerous_deserialization=True)
    qa_chain = ConversationalRetrievalChain.from_llm(
        llm,
        db.as_retriever(search_kwargs={"k": 2}),
        return_source_documents=True,
        combine_docs_chain_kwargs={"prompt": qa_prompt},
        condense_question_prompt=PromptTemplate.from_template(
            repharse_question_template
        ),
    )
    result = qa_chain({"question": query, "chat_history": chat_history})
    references = []
    try:
        for doc in result["source_documents"]:
            if "page" in doc.metadata:
                references.append(doc.metadata["page"])
            elif "page_number" in doc.metadata:
                references.append(doc.metadata["page_number"])
    except:
        pass
    chat_history.append((query, result["answer"]))
    references.sort()
    return json.dumps({"answer": result["answer"], "references": str(references)})


@app.route("/process", methods=["POST"])
def process_files():
    files = request.files.getlist("files")
    userId = request.form.get("userID")
    embed(files, userId)
    return {"message": "Files processed successfully"}


if __name__ == "__main__":
    app.run(debug=True)
