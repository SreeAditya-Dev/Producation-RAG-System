import os
import sys
import json
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import uuid
import asyncio
from datetime import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, Document
from app.services.storage_service import storage_service
from app.pipeline.ingestion import ingest_document

# Define query sets
ARXIV_TOPICS = [
    "transformer neural networks",
    "retrieval augmented generation llm",
    "vector search database index HNSW",
    "reinforcement learning from human feedback RLHF",
    "distributed database consensus raft paxos"
]

WIKI_TOPICS = [
    "Constitutional law",
    "International relations",
    "Macroeconomics",
    "Cognitive psychology",
    "Marine biology",
    "Neurotransmitters",
    "Ancient history",
    "Climate change science"
]

PUBMED_TOPICS = [
    "cardiovascular genetics immunology",
    "crispr gene editing clinical therapeutics",
    "neurological disease immunotherapy Alzheimer",
    "oncology immunotherapy checkpoint inhibitors"
]

# Helper to fetch Wikipedia articles
def fetch_wiki(title: str) -> str:
    encoded = urllib.parse.quote(title)
    url = f"https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles={encoded}&format=json"
    req = urllib.request.Request(url, headers={'User-Agent': 'RAGSystemBot/1.0'})
    try:
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode('utf-8'))
            pages = data.get("query", {}).get("pages", {})
            for pid, pdata in pages.items():
                if "extract" in pdata:
                    return pdata["extract"]
    except Exception as e:
        print(f"Wiki error '{title}': {e}")
    return ""

# Helper to fetch arXiv research papers
def fetch_arxiv(topic: str, max_results=3) -> str:
    encoded_topic = urllib.parse.quote(topic)
    url = f"http://export.arxiv.org/api/query?search_query=all:{encoded_topic}&start=0&max_results={max_results}"
    req = urllib.request.Request(url, headers={'User-Agent': 'RAGSystemBot/1.0'})
    try:
        with urllib.request.urlopen(req) as res:
            xml_data = res.read()
            root = ET.fromstring(xml_data)
            
            # Namespaces
            ns = {'atom': 'http://www.w3.org/2005/Atom'}
            
            entries = root.findall('atom:entry', ns)
            papers_md = []
            for entry in entries:
                title = entry.find('atom:title', ns)
                summary = entry.find('atom:summary', ns)
                published = entry.find('atom:published', ns)
                
                title_text = title.text.strip().replace('\n', ' ') if title is not None else "Unknown Paper"
                summary_text = summary.text.strip().replace('\n', ' ') if summary is not None else ""
                published_text = published.text.strip() if published is not None else ""
                
                authors = [author.find('atom:name', ns).text for author in entry.findall('atom:author', ns) if author.find('atom:name', ns) is not None]
                authors_text = ", ".join(authors)
                
                paper_md = f"### Paper: {title_text}\n"
                paper_md += f"- **Authors**: {authors_text}\n"
                paper_md += f"- **Published**: {published_text}\n"
                paper_md += f"- **Abstract**: {summary_text}\n\n"
                papers_md.append(paper_md)
            
            if papers_md:
                return f"# arXiv Research Papers: {topic.title()}\n\n" + "\n".join(papers_md)
    except Exception as e:
        print(f"arXiv error '{topic}': {e}")
    return ""

# Helper to fetch PubMed research articles
def fetch_pubmed(topic: str, max_results=3) -> str:
    encoded_topic = urllib.parse.quote(topic)
    search_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={encoded_topic}&retmode=json&retmax={max_results}"
    req = urllib.request.Request(search_url, headers={'User-Agent': 'RAGSystemBot/1.0'})
    try:
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode('utf-8'))
            id_list = data.get("esearchresult", {}).get("idlist", [])
            
        if not id_list:
            return ""
            
        ids_param = ",".join(id_list)
        fetch_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id={ids_param}&retmode=xml"
        req_fetch = urllib.request.Request(fetch_url, headers={'User-Agent': 'RAGSystemBot/1.0'})
        
        with urllib.request.urlopen(req_fetch) as res_fetch:
            xml_data = res_fetch.read()
            root = ET.fromstring(xml_data)
            
            articles_md = []
            for article in root.findall('.//PubmedArticle'):
                title = article.find('.//ArticleTitle')
                abstract = article.find('.//AbstractText')
                journal = article.find('.//Journal/Title')
                
                title_text = title.text.strip() if title is not None else "Unknown Publication"
                abstract_text = abstract.text.strip() if abstract is not None else "No abstract available."
                journal_text = journal.text.strip() if journal is not None else "Unknown Journal"
                
                # Authors
                author_names = []
                for author in article.findall('.//AuthorList/Author'):
                    last = author.find('LastName')
                    fore = author.find('ForeName')
                    if last is not None and fore is not None:
                        author_names.append(f"{fore.text} {last.text}")
                authors_text = ", ".join(author_names)
                
                article_md = f"### Article: {title_text}\n"
                article_md += f"- **Journal**: {journal_text}\n"
                article_md += f"- **Authors**: {authors_text}\n"
                article_md += f"- **Abstract**: {abstract_text}\n\n"
                articles_md.append(article_md)
                
            if articles_md:
                return f"# PubMed Medical Research: {topic.title()}\n\n" + "\n".join(articles_md)
    except Exception as e:
        print(f"PubMed error '{topic}': {e}")
    return ""

async def main():
    db = SessionLocal()
    try:
        # 1. Fetch & Ingest arXiv
        for topic in ARXIV_TOPICS:
            print(f"Fetching arXiv papers for '{topic}'...")
            content = fetch_arxiv(topic, max_results=4)
            if content:
                filename = f"arxiv_{topic.lower().replace(' ', '_')}.md"
                await save_and_ingest(db, filename, content)
                
        # 2. Fetch & Ingest Wikipedia
        for topic in WIKI_TOPICS:
            print(f"Fetching Wikipedia for '{topic}'...")
            extract = fetch_wiki(topic)
            if extract:
                filename = f"wikipedia_{topic.lower().replace(' ', '_')}.md"
                content = f"# Wikipedia: {topic}\n\n{extract}"
                await save_and_ingest(db, filename, content)
                
        # 3. Fetch & Ingest PubMed
        for topic in PUBMED_TOPICS:
            print(f"Fetching PubMed for '{topic}'...")
            content = fetch_pubmed(topic, max_results=4)
            if content:
                filename = f"pubmed_{topic.lower().replace(' ', '_')}.md"
                await save_and_ingest(db, filename, content)
                
    finally:
        db.close()

async def save_and_ingest(db, filename: str, content: str):
    # Check if exists
    existing = db.query(Document).filter(Document.original_name == filename).first()
    if existing:
        print(f"Document {filename} already exists. Skipping.")
        return
        
    doc_id = str(uuid.uuid4())
    s3_key = f"{doc_id}.md"
    content_bytes = content.encode("utf-8")
    
    print(f"Uploading {filename} to storage...")
    storage_service.upload(content_bytes, s3_key, "text/markdown")
    
    doc = Document(
        id=doc_id,
        original_name=filename,
        filename=s3_key,
        file_type="md",
        status="processing",
        chunk_count=0,
        file_size=len(content_bytes),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(doc)
    db.commit()
    
    print(f"Ingesting {filename} into Pinecone and Supabase Postgres...")
    try:
        chunks = await ingest_document(doc_id, s3_key, filename, "md", db)
        print(f"Successfully ingested {filename} ({chunks} chunks).")
    except Exception as e:
        print(f"Failed to ingest {filename}: {e}")

if __name__ == "__main__":
    asyncio.run(main())
