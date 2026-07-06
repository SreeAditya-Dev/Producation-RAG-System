import os
import sys
import logging
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent
sys.path.append(str(backend_dir))

# Suppress external verbose logging
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger("test_services")
logger.setLevel(logging.INFO)

# ANSI terminal colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

def print_header(title):
    print(f"\n{BOLD}{CYAN}=== {title} ==={RESET}")

def print_success(message):
    print(f"  {GREEN}[OK] {message}{RESET}")

def print_failure(message, details=""):
    print(f"  {RED}[ERROR] {message}{RESET}")
    if details:
        print(f"          Details: {details}{RESET}")

def print_info(message):
    print(f"  {YELLOW}[INFO] {message}{RESET}")

def test_database():
    print_header("Supabase PostgreSQL Database Connection")
    try:
        from app.database import engine, text
        from sqlalchemy import inspect
    except Exception as e:
        print_failure("Failed to import database modules", str(e))
        return False

    db_url = engine.url
    # Redact password for security
    safe_url = f"{db_url.drivername}://{db_url.username}:***@{db_url.host}:{db_url.port}/{db_url.database}"
    print_info(f"Target URL: {safe_url}")

    try:
        # Test connection and select 1
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
            if result == 1:
                print_success("Successfully connected and executed query (SELECT 1).")
            else:
                print_failure("Connected but got unexpected query result.")
                return False

            # Inspect tables
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            print_success(f"Discovered {len(tables)} tables in schema: {tables}")
            
            # Verify if expected tables are present
            expected = ["documents", "query_history", "query_metrics", "ingestion_metrics"]
            missing = [t for t in expected if t not in tables]
            if not missing:
                print_success("All expected database tables exist.")
            else:
                print_info(f"Missing tables (will be created on startup): {missing}")
                
        return True
    except Exception as e:
        print_failure("Database connection failed", str(e))
        return False

def test_pinecone():
    print_header("Pinecone Vector DB Connection")
    try:
        from app.services.pinecone_service import pinecone_service
        from app.config import settings
    except Exception as e:
        print_failure("Failed to import Pinecone service modules", str(e))
        return False

    if not pinecone_service.is_configured():
        print_failure("Pinecone is not configured in .env.")
        return False

    print_info(f"Target Index: {settings.pinecone_index_name}")
    print_info(f"Region/Cloud: {settings.pinecone_region} ({settings.pinecone_cloud})")

    try:
        # Test connection
        conn_ok = pinecone_service.test_connection()
        if conn_ok:
            print_success("Pinecone client connected successfully.")
        else:
            print_failure("Pinecone connection test failed.")
            return False

        # Get stats
        stats = pinecone_service.get_stats()
        if "error" in stats:
            print_failure("Failed to retrieve index stats", stats["error"])
            return False
        else:
            print_success("Successfully fetched Pinecone index stats:")
            print(f"    - Total Vector Count: {stats.get('total_vector_count')}")
            print(f"    - Dimension: {stats.get('dimension')}")
            print(f"    - Namespaces: {stats.get('namespaces')}")
        return True
    except Exception as e:
        print_failure("Pinecone connection failed", str(e))
        return False

def test_nvidia_embeddings():
    print_header("NVIDIA NIM Embeddings Service")
    try:
        from app.services.embedding_service import embedding_service
        from app.config import settings
    except Exception as e:
        print_failure("Failed to import Embedding service modules", str(e))
        return False

    if not settings.nvidia_api_key:
        print_failure("NVIDIA API key not set in .env.")
        return False

    print_info(f"Model: {settings.embedding_model}")
    print_info(f"Expected Dimension: {settings.embedding_dimension}")

    try:
        # Embed a test query
        test_text = "Testing connection and embeddings generation."
        emb, tokens = embedding_service.embed_query_tracked(test_text)
        
        if emb and len(emb) == settings.embedding_dimension:
            print_success(f"Embedding generated successfully.")
            print_success(f"Vector dimension matches expected: {len(emb)}")
            print_success(f"Tokens consumed: {tokens}")
            return True
        else:
            dim_got = len(emb) if emb else 0
            print_failure(f"Embedding returned unexpected vector dimension. Got {dim_got}, expected {settings.embedding_dimension}")
            return False
    except Exception as e:
        print_failure("NVIDIA Embedding generation failed", str(e))
        return False

def test_nvidia_llm():
    print_header("NVIDIA NIM LLM Service")
    try:
        from app.services.llm_service import llm_service
        from app.config import settings
    except Exception as e:
        print_failure("Failed to import LLM service modules", str(e))
        return False

    if not settings.nvidia_api_key:
        print_failure("NVIDIA API key not set in .env.")
        return False

    print_info(f"Model: {settings.llm_model}")

    try:
        # Test connection using build-in test
        conn_ok = llm_service.test_connection()
        if conn_ok:
            print_success("LLM service responded successfully to simple completion.")
        else:
            print_failure("LLM service connection test returned false.")
            return False

        # Run query request
        test_context = [{"original_name": "test_doc.txt", "text": "The answer to the ultimate question of life, the universe, and everything is 42."}]
        answer = llm_service.generate("What is the answer to the ultimate question?", test_context)
        print_success(f"Context-based question answered successfully.")
        print(f"    - Answer response: \"{answer.strip()}\"")
        return True
    except Exception as e:
        print_failure("NVIDIA LLM connection/generation failed", str(e))
        return False

def test_supabase_s3():
    print_header("Supabase S3 Storage Service")
    try:
        from app.services.storage_service import storage_service
        from app.config import settings
    except Exception as e:
        print_failure("Failed to import Storage service modules", str(e))
        return False

    if not storage_service.is_configured():
        print_info("Supabase S3 Storage is not fully configured. Using local fallback storage.")
        print_info(f"Local storage path: {settings.local_storage_path}")
        # Verify local path is writeable
        try:
            local_dir = Path(settings.local_storage_path)
            local_dir.mkdir(parents=True, exist_ok=True)
            test_file = local_dir / ".test_write"
            test_file.write_text("write test")
            test_file.unlink()
            print_success("Local fallback storage directory is accessible and writeable.")
            return True
        except Exception as ex:
            print_failure("Local fallback storage is not writeable", str(ex))
            return False

    print_info(f"Target Bucket: {settings.s3_bucket_name}")
    print_info(f"Endpoint: {settings.s3_endpoint_url}")

    try:
        # Test basic connection and bucket access
        client = storage_service._get_client()
        bucket = settings.s3_bucket_name
        
        # Test head bucket
        client.head_bucket(Bucket=bucket)
        print_success(f"S3 connection verified. Bucket '{bucket}' exists and is accessible.")
        
        # Try a complete upload, download, delete cycle to verify CRUD permissions
        test_key = "test_connection_probe.txt"
        test_content = b"Checking S3 upload, read, and delete permissions."
        
        # Upload
        storage_service.upload(test_content, test_key, "text/plain")
        print_success("Upload test file successful.")
        
        # Download
        temp_file_path = storage_service.download_to_temp(test_key)
        try:
            downloaded = Path(temp_file_path).read_bytes()
            if downloaded == test_content:
                print_success("Download and content match verification successful.")
            else:
                print_failure("Downloaded content did not match uploaded content.")
        finally:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
        # Delete
        storage_service.delete(test_key)
        print_success("Delete test file successful.")
        return True
    except Exception as e:
        print_failure("Supabase S3 storage verification failed", str(e))
        return False

def main():
    print(f"\n{BOLD}{GREEN}===================================================={RESET}")
    print(f"{BOLD}{GREEN}         RAG SYSTEM SERVICE INTEGRATION TEST         {RESET}")
    print(f"{BOLD}{GREEN}===================================================={RESET}")

    results = {}
    results["Database"] = test_database()
    results["Pinecone"] = test_pinecone()
    results["Embeddings"] = test_nvidia_embeddings()
    results["LLM"] = test_nvidia_llm()
    results["Storage"] = test_supabase_s3()

    print(f"\n{BOLD}{GREEN}===================================================={RESET}")
    print(f"{BOLD}{GREEN}                   SUMMARY REPORT                    {RESET}")
    print(f"{BOLD}{GREEN}===================================================={RESET}")

    all_passed = True
    for service, passed in results.items():
        status_str = f"{GREEN}PASSED{RESET}" if passed else f"{RED}FAILED{RESET}"
        if not passed:
            all_passed = False
        print(f"  {service:<15} : {status_str}")
        
    print(f"{BOLD}{GREEN}===================================================={RESET}")
    if all_passed:
        print(f"  {BOLD}{GREEN}All services are CONNECTED and WORKING!{RESET}")
    else:
        print(f"  {BOLD}{RED}Some service checks FAILED. Please review errors above.{RESET}")
    print(f"{BOLD}{GREEN}===================================================={RESET}\n")
    
    sys.exit(0 if all_passed else 1)

if __name__ == "__main__":
    main()
