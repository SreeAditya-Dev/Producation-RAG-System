import os
import sys
import uuid
import asyncio
from datetime import datetime

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, Document
from app.services.storage_service import storage_service
from app.pipeline.ingestion import ingest_document

# Define data sets
DATASETS = {
    "tech_guide.md": {
        "title": "tech_guide.md",
        "type": "md",
        "content": """# Comprehensive Technical Guide: AI-Native Systems & Vector Databases

This handbook details the technical components of modern retrieval systems, API architectures, and embedding models.

## 1. Large Language Models & Inference APIs
Modern agentic workflows rely on high-performance inference APIs to connect reasoning models to application layers. Large Language Models (LLMs) like Meta's Llama 3.1 70B and Llama 3.3 are designed to execute instructions and structure text outputs. To run these models at scale, developer platforms utilize hosted API infrastructures (such as NVIDIA NIM) which encapsulate the neural weights and stream tokens over persistent Server-Sent Events (SSE) or WebSockets.

## 2. Dense Vector Spaces & Neural Embeddings
Text segments are converted into semantic vector representations using neural embedding models. A popular model is `nvidia/nv-embedqa-e5-v5`, which outputs dense 1024-dimensional floating-point vectors. The proximity of vectors in this high-dimensional space represents the semantic similarity of the corresponding text segments, commonly measured using the cosine distance metric.

## 3. Hierarchical Navigable Small World (HNSW) Indices
Vector databases like Pinecone leverage Hierarchical Navigable Small World (HNSW) graphs to search millions of vectors in sub-millisecond timelines. HNSW creates a multi-layer graph structure where the top layers contain fewer nodes and larger hops (fast search over long distances), while the lower layers contain dense connections (high-precision search over close neighbors). This over-fetch and filter strategy ensures optimal recall.

## 4. FastAPI & Asynchronous Python Services
Asynchronous frameworks like FastAPI are utilized to coordinate high-concurrency requests, combining Pydantic validation models, background tasks, and SQL databases. SQLAlchemy models map pipeline analytics (e.g. stage latencies, token consumption) dynamically to PostgreSQL or SQLite.
"""
    },
    "general_knowledge.md": {
        "title": "general_knowledge.md",
        "type": "md",
        "content": """# General Knowledge: Space Science & Earth Milestones

This reference summarizes scientific insights regarding the solar system and key planetary systems.

## 1. The Solar System & Planetary Dynamics
The solar system consists of our Sun and everything bound to it by gravity, including the eight planets, dozens of moons, and millions of asteroids and comets. Outer gas giants (Jupiter and Saturn) and ice giants (Uranus and Neptune) are composed primarily of hydrogen, helium, and water-ammonia ice. Inner terrestrial planets (Mercury, Venus, Earth, and Mars) are rocky bodies with geological activity.

## 2. Planetary Milestones & Space Exploration
Humanity's journey into space began with the launch of Sputnik 1 in 1957, followed by Yuri Gagarin becoming the first human in space in 1961. The Apollo 11 mission successfully landed humans on the Moon in 1969. In recent decades, deep-space probes like Voyager 1 and 2 have crossed the heliopause into interstellar space, returning valuable telemetry about outer solar boundaries.

## 3. Atmospheric Science & Climate Systems
Earth's atmosphere is composed of 78% nitrogen, 21% oxygen, and trace gases like carbon dioxide and argon. The atmosphere is divided into layers: the troposphere (where weather occurs), the stratosphere (containing the protective ozone layer), the mesosphere, the thermosphere, and the exosphere. Ocean currents and atmospheric winds coordinate to distribute thermal energy across the planet.
"""
    },
    "legal_handbook.md": {
        "title": "legal_handbook.md",
        "type": "md",
        "content": """# Legal Reference: Contracts, IP, & Data Privacy Regulations

This legal guide outlines fundamental legal principles and global compliance frameworks.

## 1. Principles of Contract Law
A legally binding contract requires three essential components: offer, acceptance, and consideration. An offer represents a clear intent to enter into agreement under specific terms. Acceptance must match the offer exactly (mirror image rule). Consideration is the value exchanged between parties (e.g. payment for services). Failure to perform contract obligations constitutes a breach of contract, allowing the non-breaching party to seek damages.

## 2. Intellectual Property (IP) Frameworks
Intellectual property is divided into four main categories:
- **Patents**: Protects novel, non-obvious utility inventions and designs.
- **Trademarks**: Protects distinct names, logos, and symbols identifying trade origins.
- **Copyrights**: Protects original works of authorship (literature, software code, music).
- **Trade Secrets**: Protects confidential business information offering competitive advantages.

## 3. Global Data Privacy Regulations (GDPR & CCPA)
Data protection acts govern how companies gather, process, and store personal user info:
- **General Data Privacy Regulation (GDPR)**: European framework enforcing data minimization, the "Right to be Forgotten," and strict consent requirements. Non-compliance results in fines up to 4% of global turnover.
- **California Consumer Privacy Act (CCPA)**: Gives California residents the right to know what personal data is collected, delete it, and opt out of its sale.
"""
    },
    "healthcare_reference.md": {
        "title": "healthcare_reference.md",
        "type": "md",
        "content": """# Healthcare Reference: Cardiovascular Wellness & Clinical Terms

This guide summarizes clinical best practices for metabolic wellness and common medical systems.

## 1. Cardiovascular Health & Preventive Wellness
Cardiovascular disease remains a leading cause of mortality globally. Preventive health practices focus on managing blood pressure, lipid profiles, and blood glucose levels. Aerobic exercise (e.g., 150 minutes of moderate activity weekly) combined with a nutrient-rich diet low in saturated fats is shown to improve arterial elasticity and lower plaque buildup.

## 2. Clinical Terminology & Anatomy
Anatomical and pathological terms are derived from Greek and Latin prefixes and roots:
- **Cardio**: Relating to the heart.
- **Hepa**: Relating to the liver (e.g., hepatitis, hepatic portal system).
- **Pulmo**: Relating to the lungs (e.g., pulmonary circulation).
- **Metabolism**: The chemical processes occurring within a living organism to maintain life.

## 3. FDA Regulatory Processes & Drug Shortages
The US Food and Drug Administration (FDA) monitors medical products to guarantee safety and efficacy. The regulatory pathway includes preclinical testing followed by three phases of clinical trials:
- **Phase I**: Evaluation of safety and dosage in a small healthy volunteer cohort.
- **Phase II**: Evaluation of efficacy and side effects in patient populations.
- **Phase III**: Large-scale trial to confirm efficacy and monitor long-term adverse events.
"""
    }
}

async def main():
    db = SessionLocal()
    try:
        for filename, data in DATASETS.items():
            print(f"Processing {filename}...")
            
            # Check if exists
            existing = db.query(Document).filter(Document.original_name == filename).first()
            if existing:
                print(f"Document {filename} already exists. Skipping.")
                continue
                
            doc_id = str(uuid.uuid4())
            s3_key = f"{doc_id}.{data['type']}"
            content_bytes = data["content"].encode("utf-8")
            
            print(f"Uploading {filename} to storage...")
            storage_service.upload(content_bytes, s3_key, "text/markdown")
            
            doc = Document(
                id=doc_id,
                original_name=filename,
                filename=s3_key,
                file_type=data["type"],
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
                chunks = await ingest_document(doc_id, s3_key, filename, data["type"], db)
                print(f"Successfully ingested {filename} ({chunks} chunks).")
            except Exception as e:
                print(f"Failed to ingest {filename}: {e}")
                
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
