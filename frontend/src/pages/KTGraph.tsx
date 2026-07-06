import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useQuery } from '@tanstack/react-query';
import {
  Cpu,
  Brain,
  Database,
  Clock,
  Settings,
  Layers,
  Sparkles,
  Link as LinkIcon,
  Filter,
  Eye,
  Info,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { clsx } from 'clsx';
import { systemApi, queryApi, documentsApi } from '../services/api';

// Interface for Graph Nodes
interface GraphNode {
  id: string;
  label: string;
  type: 'central' | 'parametric' | 'external' | 'episodic' | 'procedural' | 'working' | 'entity';
  description: string;
  metadata: Record<string, string | number>;
  color: string;
  size: number;
  // 3D coordinates
  x: number;
  y: number;
  z: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  offset: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

export function KTGraph() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // States
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [rotationSpeed, setRotationSpeed] = useState<number>(0.2);
  const [showStars, setShowStars] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(50);

  // API Queries to seed the graph
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => systemApi.stats().then((r) => r.data),
  });

  const { data: queryHistory } = useQuery({
    queryKey: ['queryHistory'],
    queryFn: () => queryApi.history(5).then((r) => r.data),
  });

  const { data: docsData } = useQuery({
    queryKey: ['documentsList'],
    queryFn: () => documentsApi.list().then((r) => r.data),
  });

  // Keep a reference to the active nodes list for raycasting
  const nodesRef = useRef<GraphNode[]>([]);
  // Store camera zoom details
  const cameraDistanceRef = useRef<number>(55);
  // Store center target
  const lookAtTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // Generate Graph Data dynamically based on backend state
  const getGraphData = (): { nodes: GraphNode[]; edges: GraphEdge[] } => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // 1. Central Hub Node
    nodes.push({
      id: 'core',
      label: 'Production RAG System',
      type: 'central',
      description: 'The orchestrator connecting vector spaces, chat logs, pipelines, and Llama 3.3 weights.',
      metadata: {
        'Active Docs': stats?.total_documents || 0,
        'Vector Count': stats?.index_stats?.total_vector_count || 0,
        'Queries Logged': stats?.total_queries || 0
      },
      color: '#F4831F', // Orange
      size: 2.8,
      x: 0, y: 0, z: 0, baseX: 0, baseY: 0, baseZ: 0, offset: 0
    });

    // Helper to generate coordinates on a sphere shell
    const getSphereCoords = (index: number, total: number, radius: number): { x: number; y: number; z: number } => {
      const phi = Math.acos(-1 + (2 * index) / total);
      const theta = Math.sqrt(total * Math.PI) * phi;
      return {
        x: radius * Math.cos(theta) * Math.sin(phi),
        y: radius * Math.sin(theta) * Math.sin(phi),
        z: radius * Math.cos(phi)
      };
    };

    // 2. The 5 pillars of Hybrid Memory
    const pillars = [
      { id: 'parametric', label: 'Parametric Memory', type: 'parametric', desc: 'Pre-trained & fine-tuned neural weights containing syntax, reasoning, and world facts.', color: '#a855f7', size: 1.8 }, // Purple
      { id: 'external', label: 'External Memory', type: 'external', desc: 'Vector database store indexing the exact corporate document chunks.', color: '#3b82f6', size: 1.8 }, // Blue
      { id: 'episodic', label: 'Episodic Memory', type: 'episodic', desc: 'Sequential SQL chat log entries representing previous session contexts.', color: '#10b981', size: 1.8 }, // Green
      { id: 'procedural', label: 'Procedural Memory', type: 'procedural', desc: 'System templates, task instructions, and Pydantic tool schemas defining RAG capabilities.', color: '#f59e0b', size: 1.8 }, // Amber
      { id: 'working', label: 'Working Memory', type: 'working', desc: 'Transient GPU KV-cache holding system prompt, recent history, and retrieved context chunks.', color: '#ec4899', size: 1.8 } // Pink
    ];

    pillars.forEach((p, idx) => {
      const coords = getSphereCoords(idx, pillars.length, 16);
      nodes.push({
        id: p.id,
        label: p.label,
        type: p.type as any,
        description: p.desc,
        metadata: {
          'Latency Class': p.id === 'parametric' ? '<1ms' : p.id === 'external' ? '30-150ms' : '5-15ms',
          'Storage Format': p.id === 'parametric' ? 'Neural Weights' : p.id === 'external' ? 'Pinecone Vectors' : 'SQLite Database'
        },
        color: p.color,
        size: p.size,
        ...coords,
        baseX: coords.x, baseY: coords.y, baseZ: coords.z,
        offset: idx * 1.5
      });
      edges.push({ source: 'core', target: p.id });
    });

    // 3. Child nodes clustered around pillars

    // Cluster children for Parametric Memory
    const parametricChildren: { id: string; label: string; desc: string; metadata: Record<string, string | number> }[] = [
      { id: 'llama-model', label: 'meta/llama-3.3-70b-instruct', desc: 'Main generator model handling reasoning and generation.', metadata: { Provider: 'NVIDIA NIM', Context: '128k' } },
      { id: 'reranker-model', label: 'nvidia/llama-3.2-nv-rerankqa-1b-v2', desc: 'Cross-encoder ranking context candidates.', metadata: { Precision: 'Float16', Latency: '30ms' } }
    ];
    parametricChildren.forEach((child, i) => {
      const parent = nodes.find(n => n.id === 'parametric')!;
      const theta = (i / parametricChildren.length) * Math.PI * 2;
      const x = parent.baseX + 6 * Math.cos(theta);
      const y = parent.baseY + 6 * Math.sin(theta);
      const z = parent.baseZ + (i % 2 === 0 ? 3 : -3);
      nodes.push({
        id: child.id,
        label: child.label,
        type: 'entity',
        description: child.desc,
        metadata: child.metadata,
        color: '#d8b4fe', // Light purple
        size: 1.1,
        x, y, z, baseX: x, baseY: y, baseZ: z, offset: i * 2.2
      });
      edges.push({ source: 'parametric', target: child.id });
    });

    // Cluster children for External Memory (Docs from API)
    const baseDocs = docsData?.documents || [];
    const activeDocNodes: { id: string; label: string; desc: string; metadata: Record<string, string | number> }[] = baseDocs.slice(0, 4).map((d) => ({
      id: `doc-${d.id}`,
      label: d.original_name,
      desc: `Ingested document containing ${d.chunk_count} chunks.`,
      metadata: { Size: `${(d.file_size / 1024).toFixed(1)} KB`, Type: d.file_type.toUpperCase() }
    }));
    // Default fallback docs if empty
    const docList: { id: string; label: string; desc: string; metadata: Record<string, string | number> }[] = activeDocNodes.length > 0 ? activeDocNodes : [
      { id: 'doc-ref-1', label: 'refund_policy.pdf', desc: 'Standard customer order refund guidelines.', metadata: { Size: '182 KB', Type: 'PDF' } },
      { id: 'doc-faq-1', label: 'faq_support.md', desc: 'Frequently asked customer support guidelines.', metadata: { Size: '24 KB', Type: 'Markdown' } }
    ];
    // Add Pinecone index node
    docList.push({
      id: 'pinecone-index-node',
      label: `Pinecone: ${stats?.index_stats?.total_vector_count || 22} vectors`,
      desc: 'Serverless Pinecone index storing high-dimensional semantic chunks.',
      metadata: { Cloud: 'AWS', Region: 'us-east-1' }
    });

    docList.forEach((child, i) => {
      const parent = nodes.find(n => n.id === 'external')!;
      const theta = (i / docList.length) * Math.PI * 2;
      const x = parent.baseX + 6 * Math.cos(theta);
      const y = parent.baseY + 6 * Math.sin(theta);
      const z = parent.baseZ + (i % 2 === 0 ? 3 : -3);
      nodes.push({
        id: child.id,
        label: child.label,
        type: 'entity',
        description: child.desc,
        metadata: child.metadata,
        color: '#93c5fd', // Light Blue
        size: 1.1,
        x, y, z, baseX: x, baseY: y, baseZ: z, offset: i * 1.8
      });
      edges.push({ source: 'external', target: child.id });
    });

    // Cluster children for Episodic Memory (Queries from API)
    const baseQueries = queryHistory?.queries || [];
    const queryList: { id: string; label: string; desc: string; metadata: Record<string, string | number> }[] = baseQueries.slice(0, 3).map((q, idx) => ({
      id: `query-node-${q.query_id}`,
      label: q.question.length > 28 ? q.question.substring(0, 25) + '...' : q.question,
      desc: q.answer ? q.answer.substring(0, 80) + '...' : 'User query history log.',
      metadata: { Latency: `${(q.processing_time).toFixed(2)}s`, Status: 'SUCCESS' }
    }));
    // Default fallback queries if empty
    const histList: { id: string; label: string; desc: string; metadata: Record<string, string | number> }[] = queryList.length > 0 ? queryList : [
      { id: 'q-ref-1', label: 'Refund for order #1234', desc: 'User inquiry checking refund parameters.', metadata: { Latency: '1.2s', Status: 'SUCCESS' } },
      { id: 'q-ref-2', label: 'Cancel policy fees', desc: 'User follow-up checking cancellation costs.', metadata: { Latency: '0.9s', Status: 'SUCCESS' } }
    ];
    histList.forEach((child, i) => {
      const parent = nodes.find(n => n.id === 'episodic')!;
      const theta = (i / histList.length) * Math.PI * 2;
      const x = parent.baseX + 6 * Math.cos(theta);
      const y = parent.baseY + 6 * Math.sin(theta);
      const z = parent.baseZ + (i % 2 === 0 ? 3 : -3);
      nodes.push({
        id: child.id,
        label: child.label,
        type: 'entity',
        description: child.desc,
        metadata: child.metadata,
        color: '#6ee7b7', // Light green
        size: 1.1,
        x, y, z, baseX: x, baseY: y, baseZ: z, offset: i * 2.5
      });
      edges.push({ source: 'episodic', target: child.id });
    });

    // Cluster children for Procedural Memory
    const proceduralChildren: { id: string; label: string; desc: string; metadata: Record<string, string | number> }[] = [
      { id: 'proc-rules', label: 'SYSTEM_PROMPT Constraints', desc: 'Rules forcing the model to stick only to retrieved documents and avoid hallucinations.', metadata: { Strictness: 'High', Engine: 'Llama-Instruct' } },
      { id: 'proc-translator', label: 'QueryTranslator System', desc: 'Handles Hinglish query translations to English.', metadata: { Latency: '110ms', Model: 'Llama 3.3' } }
    ];
    proceduralChildren.forEach((child, i) => {
      const parent = nodes.find(n => n.id === 'procedural')!;
      const theta = (i / proceduralChildren.length) * Math.PI * 2;
      const x = parent.baseX + 6 * Math.cos(theta);
      const y = parent.baseY + 6 * Math.sin(theta);
      const z = parent.baseZ + (i % 2 === 0 ? 3 : -3);
      nodes.push({
        id: child.id,
        label: child.label,
        type: 'entity',
        description: child.desc,
        metadata: child.metadata,
        color: '#fcd34d', // Light Amber
        size: 1.1,
        x, y, z, baseX: x, baseY: y, baseZ: z, offset: i * 3.1
      });
      edges.push({ source: 'procedural', target: child.id });
    });

    // Cluster children for Working Memory (Context Window Compiler)
    const workingChildren: { id: string; label: string; desc: string; metadata: Record<string, string | number> }[] = [
      { id: 'work-context', label: 'Dynamic In-Context Compilation', desc: 'Framer compiler grouping System Rules + Dialogue History + Pinecone chunks.', metadata: { 'Max Size': '128,000 tokens', Latency: '0ms' } }
    ];
    workingChildren.forEach((child, i) => {
      const parent = nodes.find(n => n.id === 'working')!;
      const theta = (i / workingChildren.length) * Math.PI * 2;
      const x = parent.baseX + 6 * Math.cos(theta);
      const y = parent.baseY + 6 * Math.sin(theta);
      const z = parent.baseZ + (i % 2 === 0 ? 3 : -3);
      nodes.push({
        id: child.id,
        label: child.label,
        type: 'entity',
        description: child.desc,
        metadata: child.metadata,
        color: '#fbcfe8', // Light Pink
        size: 1.1,
        x, y, z, baseX: x, baseY: y, baseZ: z, offset: i * 1.2
      });
      edges.push({ source: 'working', target: child.id });
    });

    // Seed default selection if not set yet
    if (!selectedNode && nodes.length > 0) {
      setSelectedNode(nodes[0]);
    }

    return { nodes, edges };
  };

  const graphData = getGraphData();
  nodesRef.current = graphData.nodes;

  // React to Zoom Level Changes
  useEffect(() => {
    cameraDistanceRef.current = 80 - (zoomLevel / 100) * 50; // map 0-100 to 80-30 distance
  }, [zoomLevel]);

  // Set up Three.js 3D Simulation
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#000000', 0.008);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 15, cameraDistanceRef.current);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 3. Ambient Lights & Point Lights
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#ff7700', 1.8);
    dirLight.position.set(20, 40, 20);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight('#3b82f6', 1.5, 50);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    // 4. Create Node Meshes & Selection glow rings
    const nodeMeshes: { mesh: THREE.Mesh; data: GraphNode }[] = [];
    const spheresGroup = new THREE.Group();
    scene.add(spheresGroup);

    // Filter nodes based on state
    const filteredNodes = graphData.nodes.filter(node => {
      if (filterType === 'all') return true;
      if (filterType === 'pillars') return ['central', 'parametric', 'external', 'episodic', 'procedural', 'working'].includes(node.type);
      return node.type === filterType || (filterType === 'entity' && node.type === 'entity');
    });

    const filteredNodesMap = new Map(filteredNodes.map(n => [n.id, n]));

    filteredNodes.forEach((node) => {
      // Glow/emission effects
      const color = new THREE.Color(node.color);
      const isLarge = node.type === 'central';
      const geometry = new THREE.SphereGeometry(node.size, 24, 24);
      
      const material = new THREE.MeshPhysicalMaterial({
        color,
        emissive: color,
        emissiveIntensity: isLarge ? 0.8 : 0.4,
        roughness: 0.1,
        metalness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.95
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(node.x, node.y, node.z);
      mesh.userData = { id: node.id };
      spheresGroup.add(mesh);
      nodeMeshes.push({ mesh, data: node });
    });

    // 5. Create Connecting Edges (Lines)
    const lineMaterial = new THREE.LineBasicMaterial({
      color: '#475569',
      transparent: true,
      opacity: 0.25,
      linewidth: 1
    });

    const activeLineMaterial = new THREE.LineBasicMaterial({
      color: '#F4831F',
      transparent: true,
      opacity: 0.8,
      linewidth: 2
    });

    const linesGroup = new THREE.Group();
    scene.add(linesGroup);

    const updateLines = () => {
      // Remove old lines
      while (linesGroup.children.length > 0) {
        linesGroup.remove(linesGroup.children[0]);
      }

      graphData.edges.forEach((edge) => {
        const sourceNode = filteredNodesMap.get(edge.source);
        const targetNode = filteredNodesMap.get(edge.target);

        if (sourceNode && targetNode) {
          const points = [
            new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
            new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z)
          ];
          const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
          
          // If connection links to selected node, highlight it
          const isHighlighted = selectedNode && 
            (selectedNode.id === edge.source || selectedNode.id === edge.target);

          const line = new THREE.Line(lineGeo, isHighlighted ? activeLineMaterial : lineMaterial);
          linesGroup.add(line);
        }
      });
    };
    updateLines();

    // 6. Floating Starry Background (Procedural Particles)
    let particleSystem: THREE.Points | null = null;
    if (showStars) {
      const pCount = 500;
      const pGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(pCount * 3);
      for (let i = 0; i < pCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 200;
        positions[i+1] = (Math.random() - 0.5) * 200;
        positions[i+2] = (Math.random() - 0.5) * 200;
      }
      pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const pMat = new THREE.PointsMaterial({
        color: '#64748b',
        size: 0.6,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true
      });
      particleSystem = new THREE.Points(pGeo, pMat);
      scene.add(particleSystem);
    }

    // 7. Interactive Controls: Hover / Raycaster & Mouse Drag Orbit Rotation
    let mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;
    };
    canvasRef.current.addEventListener('mousemove', handleMouseMove);

    // Orbit Rotation Drag Logic
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let rotation = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleDragMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y
      };

      rotation.y += deltaMove.x * 0.005;
      rotation.x += deltaMove.y * 0.005;
      // Clamp pitch to avoid flips
      rotation.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, rotation.x));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    canvasRef.current.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    canvasRef.current.addEventListener('mousemove', handleDragMouseMove);

    // Mouse click handling for Node Selection
    const handleMouseClick = () => {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(spheresGroup.children);

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object as THREE.Mesh;
        const nodeId = clickedMesh.userData.id;
        const matchingNode = graphData.nodes.find(n => n.id === nodeId);
        if (matchingNode) {
          setSelectedNode(matchingNode);
          // Target camera transition
          lookAtTargetRef.current.set(matchingNode.x, matchingNode.y, matchingNode.z);
        }
      }
    };
    canvasRef.current.addEventListener('click', handleMouseClick);

    // 8. Animation & Physics Frame Loop
    let animationId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Slow dynamic float physics for nodes
      nodeMeshes.forEach(({ mesh, data }) => {
        // Floating motion
        mesh.position.x = data.baseX + Math.sin(time + data.offset) * 0.6;
        mesh.position.y = data.baseY + Math.cos(time * 0.8 + data.offset) * 0.6;
        mesh.position.z = data.baseZ + Math.sin(time * 0.5 + data.offset * 1.5) * 0.6;

        // Sync coordinates back to data object for edges/line rendering
        data.x = mesh.position.x;
        data.y = mesh.position.y;
        data.z = mesh.position.z;

        // Hover scale highlight
        const isHovered = hoveredNode && hoveredNode.id === data.id;
        const isSelected = selectedNode && selectedNode.id === data.id;
        const targetScale = isSelected ? 1.35 : isHovered ? 1.2 : 1.0;
        mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
      });

      // Update connecting line geometry positions dynamically
      updateLines();

      // Stars rotation
      if (particleSystem) {
        particleSystem.rotation.y = time * 0.015;
      }

      // Base auto orbital rotation if not user dragging
      if (!isDragging) {
        rotation.y += rotationSpeed * 0.005;
      }

      // Smooth camera interpolation towards selected node or center
      const currentDist = cameraDistanceRef.current;
      const targetCamX = lookAtTargetRef.current.x + currentDist * Math.sin(rotation.y) * Math.cos(rotation.x);
      const targetCamY = lookAtTargetRef.current.y + currentDist * Math.sin(rotation.x);
      const targetCamZ = lookAtTargetRef.current.z + currentDist * Math.cos(rotation.y) * Math.cos(rotation.x);

      camera.position.x += (targetCamX - camera.position.x) * 0.08;
      camera.position.y += (targetCamY - camera.position.y) * 0.08;
      camera.position.z += (targetCamZ - camera.position.z) * 0.08;
      camera.lookAt(lookAtTargetRef.current);

      // Perform Raycaster check
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(spheresGroup.children);
      if (intersects.length > 0) {
        const hoveredMesh = intersects[0].object as THREE.Mesh;
        const id = hoveredMesh.userData.id;
        const matched = graphData.nodes.find(n => n.id === id);
        if (matched && hoveredNode?.id !== matched.id) {
          setHoveredNode(matched);
        }
      } else {
        setHoveredNode(null);
      }

      renderer.render(scene, camera);
    };

    animate();

    // 9. Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup functions
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mouseup', handleMouseUp);
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('mousemove', handleMouseMove);
        canvasRef.current.removeEventListener('mousedown', handleMouseDown);
        canvasRef.current.removeEventListener('mousemove', handleDragMouseMove);
        canvasRef.current.removeEventListener('click', handleMouseClick);
      }
      renderer.dispose();
    };
  }, [filterType, showStars, rotationSpeed, stats, queryHistory, docsData]);

  // Helper mapping icon component by node type
  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'central': return Sparkles;
      case 'parametric': return Brain;
      case 'external': return Database;
      case 'episodic': return Clock;
      case 'procedural': return Settings;
      case 'working': return Layers;
      default: return Cpu;
    }
  };

  const IconComponent = selectedNode ? getNodeIcon(selectedNode.type) : Cpu;

  return (
    <div className="flex h-[calc(100vh-65px)] overflow-hidden bg-black text-slate-100 font-sans relative">
      
      {/* ── Background Glow Overlay ── */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-950/20 via-black to-black pointer-events-none z-0" />
      
      {/* ── Left Sidebar: Floating Interactive Settings ── */}
      <div className="absolute left-6 top-6 bottom-6 w-[320px] flex flex-col gap-5 z-10 pointer-events-none">
        
        {/* Memory Type filter (Glassmorphic) */}
        <div className="pointer-events-auto rounded-2xl border border-white/5 bg-[#09090b]/80 backdrop-blur-xl p-5 shadow-2xl shadow-black/90 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#71717a] uppercase tracking-wider">
            <Filter size={14} className="text-orange-500" />
            <span>Filter Memory Nodes</span>
          </div>

          <div className="space-y-1">
            {[
              { id: 'all', label: 'All Memory Layers' },
              { id: 'pillars', label: 'Primary Pillars Only' },
              { id: 'parametric', label: 'Parametric Memory' },
              { id: 'external', label: 'External (Pinecone)' },
              { id: 'episodic', label: 'Episodic (Chat DB)' },
              { id: 'procedural', label: 'Procedural Rules' },
              { id: 'working', label: 'Working Context' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={clsx(
                  "w-full text-left px-3 py-2 text-xs font-medium rounded-xl border transition-all duration-200",
                  filterType === f.id
                    ? "bg-orange-500/10 border-orange-500/30 text-white shadow-lg shadow-orange-500/5"
                    : "bg-transparent border-transparent text-[#8b8b9f] hover:bg-white/5 hover:text-white"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Simulation Tweak Controls */}
        <div className="pointer-events-auto rounded-2xl border border-white/5 bg-[#09090b]/80 backdrop-blur-xl p-5 shadow-2xl shadow-black/90 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#71717a] uppercase tracking-wider">
            <Settings size={14} className="text-orange-500" />
            <span>Simulation Parameters</span>
          </div>

          <div className="space-y-4">
            {/* Speed */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-[#8b8b9f]">
                <span>Orbital Speed</span>
                <span className="text-white font-semibold">{rotationSpeed}x</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={rotationSpeed}
                onChange={(e) => setRotationSpeed(parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            {/* Zoom */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-[#8b8b9f]">
                <span>Distance Factor</span>
                <span className="text-white font-semibold">{zoomLevel}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            {/* Toggle Ambient Stars */}
            <button
              onClick={() => setShowStars(!showStars)}
              className={clsx(
                "w-full flex items-center justify-between text-xs font-medium px-3 py-2.5 rounded-xl border transition-all duration-200",
                showStars 
                  ? "bg-white/5 border-white/10 text-white" 
                  : "bg-transparent border-transparent text-[#8b8b9f] hover:bg-white/5"
              )}
            >
              <div className="flex items-center gap-2">
                <Eye size={13} className="text-orange-500" />
                <span>Ambient Stars</span>
              </div>
              <span className="text-[10px] font-bold text-orange-500 uppercase">{showStars ? 'Active' : 'Muted'}</span>
            </button>
          </div>
        </div>

        {/* System Node Indicator */}
        <div className="pointer-events-auto rounded-2xl border border-white/5 bg-[#09090b]/80 backdrop-blur-xl p-4 shadow-2xl shadow-black/90 mt-auto">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-xs font-bold text-orange-500">
              3D
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-white truncate">Perspective View</h4>
              <p className="text-[10px] text-[#71717a] truncate">Drag mouse to orbit. Hover nodes to view.</p>
            </div>
          </div>
        </div>

      </div>

      {/* ── Main Canvas Viewport ── */}
      <div ref={containerRef} className="flex-1 h-full w-full relative z-0">
        <canvas ref={canvasRef} className="h-full w-full block cursor-grab active:cursor-grabbing" />
        
        {/* Floating instructions layer */}
        <div className="absolute top-6 left-[340px] pointer-events-none bg-black/40 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-white/5 text-[10px] text-[#71717a] flex items-center gap-1.5">
          <Info size={11} className="text-orange-500" />
          <span>Left-click: Select node | Click + Drag: Rotate | Scroll: Zoom</span>
        </div>

        {/* Floating Hover Card (follows hover) */}
        {hoveredNode && (
          <div 
            className="absolute bottom-28 left-[340px] pointer-events-none bg-zinc-950/90 border border-orange-500/20 backdrop-blur-xl px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in animate-duration-150"
          >
            <div 
              className="h-8 w-8 rounded-lg border flex items-center justify-center text-white shadow-md shrink-0"
              style={{ backgroundColor: `${hoveredNode.color}15`, borderColor: hoveredNode.color }}
            >
              {(() => {
                const Icon = getNodeIcon(hoveredNode.type);
                return <Icon size={14} style={{ color: hoveredNode.color }} />;
              })()}
            </div>
            <div>
              <h5 className="text-xs font-bold text-white leading-none">{hoveredNode.label}</h5>
              <span className="text-[9px] uppercase tracking-wider font-bold mt-1 block" style={{ color: hoveredNode.color }}>
                {hoveredNode.type}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Right Sidebar: Memory Node Details Inspector ── */}
      {selectedNode && (
        <div className="w-[380px] border-l border-zinc-900 bg-[#09090b]/90 backdrop-blur-xl p-6 flex flex-col gap-6 relative z-10 shadow-2xl shadow-black/80 h-full overflow-y-auto no-scrollbar">
          
          {/* Header */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">
              Node Inspector
            </span>
            <div className="flex items-center gap-3 mt-1">
              <div 
                className="h-10 w-10 rounded-xl border flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: `${selectedNode.color}15`, borderColor: selectedNode.color }}
              >
                <IconComponent size={18} style={{ color: selectedNode.color }} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white truncate leading-tight">
                  {selectedNode.label}
                </h3>
                <span className="text-[9px] uppercase tracking-wider font-extrabold mt-0.5 block" style={{ color: selectedNode.color }}>
                  {selectedNode.type} memory layer
                </span>
              </div>
            </div>
          </div>

          <hr className="border-zinc-900" />

          {/* Description */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider">
              Functional Description
            </span>
            <p className="text-xs text-[#8b8b9f] leading-relaxed">
              {selectedNode.description}
            </p>
          </div>

          {/* Meta Details List */}
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider">
              Metadata Properties
            </span>

            <div className="bg-[#0f0f13] border border-white/5 rounded-xl p-4 space-y-3">
              {Object.entries(selectedNode.metadata).map(([key, val]) => (
                <div key={key} className="flex justify-between items-center text-xs">
                  <span className="text-[#52525b] font-medium">{key}</span>
                  <span className="text-slate-100 font-bold">{val}</span>
                </div>
              ))}
              <div className="flex justify-between items-center text-xs pt-1 border-t border-zinc-900">
                <span className="text-[#52525b] font-medium">Node ID</span>
                <code className="text-[10px] text-zinc-500 font-mono select-all truncate max-w-[150px]" title={selectedNode.id}>
                  {selectedNode.id}
                </code>
              </div>
            </div>
          </div>

          {/* Connection List */}
          <div className="flex flex-col gap-3 mt-auto">
            <span className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider">
              Network Connections
            </span>

            <div className="space-y-1.5">
              {graphData.edges
                .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                .map((edge, idx) => {
                  const targetId = edge.source === selectedNode.id ? edge.target : edge.source;
                  const targetNode = graphData.nodes.find(n => n.id === targetId);

                  if (!targetNode) return null;

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedNode(targetNode);
                        lookAtTargetRef.current.set(targetNode.x, targetNode.y, targetNode.z);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl bg-zinc-950/50 hover:bg-[#121216] border border-zinc-900 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <LinkIcon size={12} className="text-[#71717a]" />
                        <span className="text-[#8b8b9f] font-medium truncate max-w-[200px]">{targetNode.label}</span>
                      </div>
                      <ChevronRight size={12} className="text-zinc-600" />
                    </button>
                  );
                })}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}

export default KTGraph;
