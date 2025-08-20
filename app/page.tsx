"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Edge {
  from: number
  to: number
  weight: number
}

interface Node {
  id: number
  x: number
  y: number
}

type Algorithm = "kruskal" | "prim"

export default function MSTVisualizer() {
  const [adjacencyMatrix, setAdjacencyMatrix] = useState<string>("")
  const [matrixSize, setMatrixSize] = useState<number>(4)
  const [graph, setGraph] = useState<{ nodes: Node[]; edges: Edge[]; matrix: number[][] }>({
    nodes: [],
    edges: [],
    matrix: [],
  })
  const [mstEdges, setMstEdges] = useState<Edge[]>([])
  const [currentStep, setCurrentStep] = useState<number>(-1)
  const [sortedEdges, setSortedEdges] = useState<Edge[]>([])
  const [disjointSet, setDisjointSet] = useState<number[]>([])
  const [error, setError] = useState<string>("")
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [autoRunSpeed, setAutoRunSpeed] = useState<number>(500)
  const [algorithm, setAlgorithm] = useState<Algorithm>("kruskal")
  const [startVertex, setStartVertex] = useState<number>(0)

  // Prim's algorithm states
  const [primVisited, setPrimVisited] = useState<boolean[]>([])
  const [primQueue, setPrimQueue] = useState<Edge[]>([])
  const [primCurrentEdge, setPrimCurrentEdge] = useState<Edge | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Generate empty adjacency matrix
  const generateEmptyMatrix = (size: number) => {
    const matrix = Array(size)
      .fill(0)
      .map(() => Array(size).fill(0))

    // Format the matrix as a string
    const matrixString = matrix.map((row) => row.join(" ")).join("\n")

    setAdjacencyMatrix(matrixString)
  }

  // Generate a random adjacency matrix
  const generateRandomMatrix = (size: number) => {
    const matrix = Array(size)
      .fill(0)
      .map(() => Array(size).fill(0))

    // Fill the matrix with random weights (symmetric)
    for (let i = 0; i < size; i++) {
      for (let j = i + 1; j < size; j++) {
        // 70% chance of having an edge
        if (Math.random() < 0.7) {
          const weight = Math.floor(Math.random() * 9) + 1
          matrix[i][j] = weight
          matrix[j][i] = weight
        }
      }
    }

    // Format the matrix as a string
    const matrixString = matrix.map((row) => row.join(" ")).join("\n")

    setAdjacencyMatrix(matrixString)
  }

  // Parse the adjacency matrix input
  const parseMatrix = () => {
    try {
      const rows = adjacencyMatrix.trim().split("\n")
      const matrix = rows.map((row) =>
        row
          .trim()
          .split(/\s+/)
          .map((val) => Number.parseInt(val, 10)),
      )

      // Validate matrix dimensions
      const n = matrix.length
      if (matrix.some((row) => row.length !== n)) {
        throw new Error("Matrix must be square")
      }

      // Validate symmetry
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (matrix[i][j] !== matrix[j][i]) {
            throw new Error("Matrix must be symmetric")
          }
        }
      }

      // Create nodes and edges
      const nodes: Node[] = []
      const edges: Edge[] = []

      // Create nodes in a circular layout
      const radius = 150
      const centerX = 250
      const centerY = 250

      for (let i = 0; i < n; i++) {
        const angle = (i * 2 * Math.PI) / n
        nodes.push({
          id: i,
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        })
      }

      // Create edges
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (matrix[i][j] > 0) {
            edges.push({
              from: i,
              to: j,
              weight: matrix[i][j],
            })
          }
        }
      }

      setGraph({ nodes, edges, matrix })
      setStartVertex(Math.min(startVertex, n - 1))
      setError("")
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid input")
      return false
    }
  }

  // Initialize Kruskal's algorithm
  const initializeKruskal = () => {
    // Sort edges by weight
    const sorted = [...graph.edges].sort((a, b) => a.weight - b.weight)
    setSortedEdges(sorted)

    // Initialize disjoint set (each node in its own set)
    const sets = Array(graph.nodes.length)
      .fill(0)
      .map((_, i) => i)
    setDisjointSet(sets)

    setMstEdges([])
    setCurrentStep(-1)
    setIsRunning(false)
  }

  // Initialize Prim's algorithm
  const initializePrim = () => {
    const n = graph.nodes.length
    if (n === 0) return

    // Initialize visited array
    const visited = Array(n).fill(false)
    visited[startVertex] = true
    setPrimVisited(visited)

    // Initialize priority queue with edges from start vertex
    const queue: Edge[] = []
    for (let i = 0; i < n; i++) {
      if (i !== startVertex && graph.matrix[startVertex][i] > 0) {
        queue.push({
          from: startVertex,
          to: i,
          weight: graph.matrix[startVertex][i],
        })
      }
    }

    // Sort queue by weight
    queue.sort((a, b) => a.weight - b.weight)
    setPrimQueue(queue)
    setPrimCurrentEdge(null)

    setMstEdges([])
    setCurrentStep(-1)
    setIsRunning(false)
  }

  // Find the representative of a set (with path compression)
  const find = (parent: number[], i: number): number => {
    if (parent[i] !== i) {
      parent[i] = find(parent, parent[i])
    }
    return parent[i]
  }

  // Union of two sets
  const union = (parent: number[], x: number, y: number): number[] => {
    const rootX = find(parent, x)
    const rootY = find(parent, y)

    if (rootX !== rootY) {
      parent[rootY] = rootX
    }

    return [...parent]
  }

  // Step through Kruskal's algorithm
  const stepKruskal = () => {
    if (currentStep >= sortedEdges.length - 1) {
      setIsRunning(false)
      return
    }

    const nextStep = currentStep + 1
    setCurrentStep(nextStep)

    const edge = sortedEdges[nextStep]
    const rootFrom = find(disjointSet, edge.from)
    const rootTo = find(disjointSet, edge.to)

    if (rootFrom !== rootTo) {
      // Add edge to MST
      setMstEdges((prev) => [...prev, edge])
      // Union the sets
      setDisjointSet(union(disjointSet, rootFrom, rootTo))
    }
  }

  // Step through Prim's algorithm
  const stepPrim = () => {
    if (primQueue.length === 0 || mstEdges.length >= graph.nodes.length - 1) {
      setIsRunning(false)
      setPrimCurrentEdge(null)
      return
    }

    // Get the minimum weight edge
    const edge = primQueue.shift()!
    setPrimCurrentEdge(edge)

    // If the destination is already visited, skip this edge
    if (primVisited[edge.to]) {
      return
    }

    // Add edge to MST
    setMstEdges((prev) => [...prev, edge])

    // Mark destination as visited
    const newVisited = [...primVisited]
    newVisited[edge.to] = true
    setPrimVisited(newVisited)

    // Add new edges to the queue
    const newEdges: Edge[] = []
    for (let i = 0; i < graph.nodes.length; i++) {
      if (!newVisited[i] && graph.matrix[edge.to][i] > 0) {
        newEdges.push({
          from: edge.to,
          to: i,
          weight: graph.matrix[edge.to][i],
        })
      }
    }

    // Add new edges to queue and sort
    const newQueue = [...primQueue, ...newEdges].sort((a, b) => a.weight - b.weight)
    setPrimQueue(newQueue)

    setCurrentStep((prev) => prev + 1)
  }

  // Step through the selected algorithm
  const stepAlgorithm = () => {
    if (algorithm === "kruskal") {
      stepKruskal()
    } else {
      stepPrim()
    }
  }

  // Run the selected algorithm
  const runAlgorithm = () => {
    if (parseMatrix()) {
      if (algorithm === "kruskal") {
        initializeKruskal()
      } else {
        initializePrim()
      }
      setIsRunning(true)
    }
  }

  // Reset the visualization
  const resetVisualization = () => {
    setMstEdges([])
    setCurrentStep(-1)
    setPrimCurrentEdge(null)
    setIsRunning(false)
  }

  // Auto-run effect
  useEffect(() => {
    let timer: NodeJS.Timeout

    if (isRunning) {
      if (algorithm === "kruskal" && currentStep < sortedEdges.length - 1) {
        timer = setTimeout(stepKruskal, autoRunSpeed)
      } else if (algorithm === "prim" && mstEdges.length < graph.nodes.length - 1 && primQueue.length > 0) {
        timer = setTimeout(stepPrim, autoRunSpeed)
      } else {
        setIsRunning(false)
      }
    }

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [
    isRunning,
    currentStep,
    sortedEdges.length,
    algorithm,
    mstEdges.length,
    graph.nodes.length,
    primQueue.length,
    autoRunSpeed,
  ])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    graph.edges.forEach((edge) => {
      const fromNode = graph.nodes.find((n) => n.id === edge.from)
      const toNode = graph.nodes.find((n) => n.id === edge.to)

      if (fromNode && toNode) {
        ctx.beginPath()
        ctx.moveTo(fromNode.x, fromNode.y)
        ctx.lineTo(toNode.x, toNode.y)
        ctx.strokeStyle = "#aaa"
        ctx.lineWidth = 1
        ctx.stroke()

        const midX = (fromNode.x + toNode.x) / 2
        const midY = (fromNode.y + toNode.y) / 2
        ctx.fillStyle = "#000"
        ctx.font = "12px Arial"
        ctx.fillText(edge.weight.toString(), midX, midY)
      }
    })

    // Draw current edge being considered in Prim's algorithm
    if (algorithm === "prim" && primCurrentEdge) {
      const fromNode = graph.nodes.find((n) => n.id === primCurrentEdge.from)
      const toNode = graph.nodes.find((n) => n.id === primCurrentEdge.to)

      if (fromNode && toNode) {
        ctx.beginPath()
        ctx.moveTo(fromNode.x, fromNode.y)
        ctx.lineTo(toNode.x, toNode.y)
        ctx.strokeStyle = "#0088ff"
        ctx.lineWidth = 2
        ctx.setLineDash([5, 3])
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // Draw MST edges
    mstEdges.forEach((edge) => {
      const fromNode = graph.nodes.find((n) => n.id === edge.from)
      const toNode = graph.nodes.find((n) => n.id === edge.to)

      if (fromNode && toNode) {
        ctx.beginPath()
        ctx.moveTo(fromNode.x, fromNode.y)
        ctx.lineTo(toNode.x, toNode.y)
        ctx.strokeStyle = "#f00"
        ctx.lineWidth = 3
        ctx.stroke()
      }
    })

    // Draw nodes
    graph.nodes.forEach((node) => {
      ctx.beginPath()
      ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI)

      // Different fill for start vertex in Prim's algorithm
      if (algorithm === "prim" && node.id === startVertex) {
        ctx.fillStyle = "#ffcc00"
      } else if (algorithm === "prim" && primVisited[node.id]) {
        ctx.fillStyle = "#ccffcc"
      } else {
        ctx.fillStyle = "#fff"
      }

      ctx.fill()
      ctx.strokeStyle = "#000"
      ctx.lineWidth = 2
      ctx.stroke()

      // Draw node label
      ctx.fillStyle = "#000"
      ctx.font = "16px Arial"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(node.id.toString(), node.x, node.y)
    })
  }, [graph, mstEdges, algorithm, startVertex, primVisited, primCurrentEdge])

  // Initialize with an empty matrix
  useEffect(() => {
    generateEmptyMatrix(matrixSize)
  }, [matrixSize])

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Minimum Spanning Tree Algorithms Visualizer</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-2">Input Adjacency Matrix</h2>

            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="matrix-size">Matrix Size:</Label>
                <Input
                  id="matrix-size"
                  type="number"
                  min="2"
                  max="10"
                  value={matrixSize}
                  onChange={(e) => setMatrixSize(Number.parseInt(e.target.value, 10))}
                  className="w-20"
                />
              </div>

              <Button onClick={() => generateEmptyMatrix(matrixSize)}>Empty Matrix</Button>

              <Button onClick={() => generateRandomMatrix(matrixSize)}>Random Matrix</Button>
            </div>

            <Textarea
              value={adjacencyMatrix}
              onChange={(e) => setAdjacencyMatrix(e.target.value)}
              rows={10}
              placeholder="Enter adjacency matrix (space-separated values, one row per line)"
              className="font-mono"
            />

            {error && <p className="text-red-500 mt-2">{error}</p>}

            <div className="mt-4 flex gap-2">
              <Button onClick={() => parseMatrix()}>Parse Matrix</Button>
            </div>
          </Card>

          <Card className="p-4 mt-4">
            <h2 className="text-xl font-semibold mb-2">Algorithm Selection</h2>

            <Tabs value={algorithm} onValueChange={(value) => setAlgorithm(value as Algorithm)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="kruskal">Kruskal&apos;s Algorithm</TabsTrigger>
                <TabsTrigger value="prim">Prim&apos;s Algorithm</TabsTrigger>
              </TabsList>

              <TabsContent value="kruskal">
                <p className="text-sm text-gray-600 mb-4">
                  Kruskal&apos;s algorithm builds the MST by adding the smallest weight edge that doesn&apos;t create a
                  cycle.
                </p>
              </TabsContent>

              <TabsContent value="prim">
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Prim&apos;s algorithm builds the MST by starting from a vertex and adding the smallest weight edge
                    that connects to a new vertex.
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    <Label htmlFor="start-vertex">Start Vertex:</Label>
                    <Select
                      value={startVertex.toString()}
                      onValueChange={(value) => setStartVertex(Number.parseInt(value, 10))}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue placeholder="Vertex" />
                      </SelectTrigger>
                      <SelectContent>
                        {graph.nodes.map((node) => (
                          <SelectItem key={node.id} value={node.id.toString()}>
                            {node.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-4 flex gap-2">
              <Button onClick={runAlgorithm}>Run {algorithm === "kruskal" ? "Kruskal's" : "Prim's"} Algorithm</Button>

              <Button onClick={resetVisualization} variant="outline">
                Reset
              </Button>
            </div>
          </Card>

          <Card className="p-4 mt-4">
            <h2 className="text-xl font-semibold mb-2">Algorithm Controls</h2>

            <div className="flex items-center gap-4 mb-4">
              <Button
                onClick={stepAlgorithm}
                disabled={
                  (algorithm === "kruskal" && currentStep >= sortedEdges.length - 1) ||
                  (algorithm === "prim" && (primQueue.length === 0 || mstEdges.length >= graph.nodes.length - 1)) ||
                  isRunning
                }
              >
                Step Forward
              </Button>

              <Button
                onClick={() => setIsRunning(!isRunning)}
                disabled={
                  (algorithm === "kruskal" && currentStep >= sortedEdges.length - 1) ||
                  (algorithm === "prim" && (primQueue.length === 0 || mstEdges.length >= graph.nodes.length - 1))
                }
              >
                {isRunning ? "Pause" : "Auto Run"}
              </Button>

              <div className="flex items-center gap-2">
                <Label htmlFor="speed">Speed:</Label>
                <Input
                  id="speed"
                  type="range"
                  min="100"
                  max="2000"
                  step="100"
                  value={autoRunSpeed}
                  onChange={(e) => setAutoRunSpeed(Number.parseInt(e.target.value, 10))}
                  className="w-32"
                />
                <span>{autoRunSpeed}ms</span>
              </div>
            </div>

            <div>
              {algorithm === "kruskal" ? (
                <p>
                  Current Step: {currentStep + 1} / {sortedEdges.length}
                </p>
              ) : (
                <p>
                  Visited Vertices: {primVisited.filter(Boolean).length} / {graph.nodes.length}
                </p>
              )}

              <p>
                MST Edges: {mstEdges.length} / {graph.nodes.length > 0 ? graph.nodes.length - 1 : 0}
              </p>

              {mstEdges.length > 0 && (
                <div className="mt-2">
                  <p className="font-semibold">MST Edges:</p>
                  <ul className="list-disc pl-5">
                    {mstEdges.map((edge, idx) => (
                      <li key={idx}>
                        {edge.from} -- {edge.to} (weight: {edge.weight})
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2">Total MST Weight: {mstEdges.reduce((sum, edge) => sum + edge.weight, 0)}</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div>
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-2">Graph Visualization</h2>
            <div className="border rounded">
              <canvas ref={canvasRef} width={500} height={500} className="bg-white" />
            </div>

            <div className="mt-4">
              <p className="text-sm text-gray-600">
                <span className="inline-block w-4 h-4 bg-gray-300 mr-2"></span>
                Original Graph Edges
              </p>
              <p className="text-sm text-gray-600">
                <span className="inline-block w-4 h-4 bg-red-500 mr-2"></span>
                MST Edges
              </p>
              {algorithm === "prim" && (
                <>
                  <p className="text-sm text-gray-600">
                    <span className="inline-block w-4 h-4 bg-blue-300 mr-2 border border-blue-500 border-dashed"></span>
                    Current Edge Being Considered
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="inline-block w-4 h-4 bg-yellow-300 mr-2"></span>
                    Start Vertex
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="inline-block w-4 h-4 bg-green-100 mr-2"></span>
                    Visited Vertices
                  </p>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
