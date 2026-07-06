import os
import sys
import json
import urllib.request
import urllib.parse
import uuid
import asyncio
from datetime import datetime

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, Document
from app.services.storage_service import storage_service
from app.pipeline.ingestion import ingest_document

WIKI_TITLES = [
    # Tech
    "Artificial intelligence",
    "Machine learning",
    "Quantum computing",
    "Vector database",
    "Web scraping",
    
    # General Knowledge
    "Solar System",
    "Industrial Revolution",
    "United Nations",
    "History of Earth",
    
    # Law
    "Constitutional law",
    "Common law",
    "Contract",
    "Intellectual property",
    
    # Healthcare
    "Public health",
    "Human anatomy",
    "Cardiology",
    "Immunology"
]

def fetch_wikipedia_article(title: str) -> str:
    encoded_title = urllib.parse.quote(title)
    url = f"https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles={encoded_title}&format=json"
    
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'RAGSystemBot/1.0 (contact@example.com)'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            pages = data.get("query", {}).get("pages", {})
            for page_id, page_data in pages.items():
                if "extract" in page_data:
                    return page_data["extract"]
    except Exception as e:
        print(f"Error fetching Wikipedia page '{title}': {e}")
    return ""

async def main():
    db = SessionLocal()
    try:
        for title in WIKI_TITLES:
            print(f"Fetching Wikipedia article for '{title}'...")
            extract = fetch_wikipedia_article(title)
            
            if not extract or len(extract.strip()) < 100:
                print(f"Empty or too short content for '{title}'. Skipping.")
                continue
                
            filename = f"wikipedia_{title.lower().replace(' ', '_')}.md"
            
            # Check if exists
            existing = db.query(Document).filter(Document.original_name == filename).first()
            if existing:
                print(f"Document {filename} already exists. Skipping.")
                continue
                
            doc_id = str(uuid.uuid4())
            s3_key = f"{doc_id}.md"
            
            markdown_content = f"# Wikipedia: {title}\n\n{extract}"
            content_bytes = markdown_content.encode("utf-8")
            
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
            
            print(f"Ingesting {filename} into Pinecone and Database...")
            try:
                chunks = await ingest_document(doc_id, s3_key, filename, "md", db)
                print(f"Successfully ingested {filename} ({chunks} chunks).")
            except Exception as e:
                print(f"Failed to ingest {filename}: {e}")
                
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
