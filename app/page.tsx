"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import * as faceapi from "face-api.js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Upload, Camera, Check, X, Loader2, AlertTriangle, Download, RefreshCw } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export default function FaceVerification() {
  const [modelLoadingStatus, setModelLoadingStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isRealtimeVerification, setIsRealtimeVerification] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"app" | "setup">("app")
  const [debugInfo, setDebugInfo] = useState<string>("")
  const [faceAttributes, setFaceAttributes] = useState<{
    age: number | null
    gender: string | null
    expressions: Record<string, number> | null
  }>({
    age: null,
    gender: null,
    expressions: null,
  })
  const [verificationResult, setVerificationResult] = useState<{
    isMatch: boolean | null
    confidence: number | null
    message: string
  }>({
    isMatch: null,
    confidence: null,
    message: "",
  })

  const webcamRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const uploadedImageRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const verificationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setModelLoadingStatus("loading")
        setErrorMessage(null)

        // Try CDN first as a fallback
        const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models"
        const GENDER_URL = "/models"

        // Configure faceapi to use the correct model URL
        faceapi.env.monkeyPatch({
          Canvas: HTMLCanvasElement,
          Image: HTMLImageElement,
          ImageData: ImageData,
          Video: HTMLVideoElement,
          createCanvasElement: () => document.createElement("canvas"),
          createImageElement: () => document.createElement("img"),
        })

        // Load models sequentially and update progress
        setLoadingProgress(10)
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
        setLoadingProgress(30)

        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        setLoadingProgress(50)

        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        setLoadingProgress(70)

        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        setLoadingProgress(85)

        // Load age and gender model
        await faceapi.nets.ageGenderNet.loadFromUri(GENDER_URL)
        setLoadingProgress(100)

        setModelLoadingStatus("success")
      } catch (error) {
        console.error("Error loading models:", error)
        setModelLoadingStatus("error")
        setErrorMessage(`${error instanceof Error ? error.message : String(error)}`)
        // Automatically switch to setup tab when model loading fails
        setActiveTab("setup")
      }
    }

    if (modelLoadingStatus === "idle" || modelLoadingStatus === "loading") {
      loadModels()
    }

    // Cleanup function
    return () => {
      stopRealtimeVerification()
      if (webcamRef.current && webcamRef.current.srcObject) {
        const stream = webcamRef.current.srcObject as MediaStream
        const tracks = stream.getTracks()
        tracks.forEach((track) => track.stop())
      }
    }
  }, [modelLoadingStatus])

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string)
        setVerificationResult({
          isMatch: null,
          confidence: null,
          message: "",
        })

        // If realtime verification is on and camera is active, start verification
        if (isRealtimeVerification && isCameraActive) {
          startRealtimeVerification()
        }
      }
      reader.readAsDataURL(file)
    }
  }

  // Start webcam
  const startWebcam = async () => {
    try {
      setDebugInfo("Requesting webcam access...")

      // Create a new video element if the ref isn't available
      if (!webcamRef.current) {
        setDebugInfo("Webcam ref not available, creating fallback element")
        const tempVideo = document.createElement("video")
        tempVideo.setAttribute("autoplay", "")
        tempVideo.setAttribute("playsInline", "")
        tempVideo.setAttribute("muted", "")
        document.body.appendChild(tempVideo)
        webcamRef.current = tempVideo
      }

      // Stop any existing stream first to avoid conflicts
      if (webcamRef.current.srcObject) {
        const stream = webcamRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        webcamRef.current.srcObject = null
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      })

      setDebugInfo("Webcam access granted, setting up video element...")

      // Set camera as active immediately to prevent auto-stopping
      setIsCameraActive(true)

      if (webcamRef.current) {
        // Set srcObject
        webcamRef.current.srcObject = stream

        // Set up event handlers
        webcamRef.current.onloadedmetadata = () => {
          setDebugInfo("Video metadata loaded, attempting to play...")

          if (webcamRef.current) {
            // Set canvas dimensions
            if (canvasRef.current) {
              canvasRef.current.width = webcamRef.current.videoWidth || 640
              canvasRef.current.height = webcamRef.current.videoHeight || 480
              setDebugInfo(`Canvas set to ${canvasRef.current.width}x${canvasRef.current.height}`)
            }

            // Force play with error handling
            webcamRef.current
                .play()
                .then(() => {
                  setDebugInfo("Video playing successfully!")

                  // Start verification if needed
                  if (isRealtimeVerification && uploadedImage) {
                    startRealtimeVerification()
                  }
                })
                .catch((playError) => {
                  setDebugInfo(`Error playing video: ${playError}. Try clicking anywhere on the page.`)
                  setErrorMessage(`Failed to play video: ${playError}. Try clicking on the page to enable autoplay.`)
                })
          }
        }

        // Add error handler for video element
        webcamRef.current.onerror = (err) => {
          setDebugInfo(`Video element error: ${err}`)
          setErrorMessage(`Video element error: ${err}`)
        }
      } else {
        setDebugInfo("Webcam ref is STILL not available after fallback!")
        setErrorMessage("Critical error: Could not initialize webcam element")
      }
    } catch (error) {
      console.error("Error accessing webcam:", error)
      setErrorMessage(`Failed to access webcam: ${error instanceof Error ? error.message : String(error)}`)
      setDebugInfo(`Webcam error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Add a new function to manually restart the webcam if needed
  const restartWebcam = () => {
    setDebugInfo("Attempting to restart webcam...")
    stopWebcam()
    setTimeout(() => {
      startWebcam()
    }, 500)
  }

  // Stop webcam
  const stopWebcam = () => {
    stopRealtimeVerification()

    if (webcamRef.current && webcamRef.current.srcObject) {
      const stream = webcamRef.current.srcObject as MediaStream
      const tracks = stream.getTracks()
      tracks.forEach((track) => track.stop())
      webcamRef.current.srcObject = null
      setIsCameraActive(false)
      setDebugInfo("Camera stopped")
    }
  }

  // Start realtime verification
  const startRealtimeVerification = () => {
    // Clear any existing interval
    stopRealtimeVerification()

    // Only start if we have an uploaded image and active camera
    if (!uploadedImage || !isCameraActive) {
      setDebugInfo("Cannot start verification: missing image or inactive camera")
      return
    }

    setIsVerifying(true)
    setDebugInfo("Starting real-time verification")

    // Run verification every 500ms
    verificationIntervalRef.current = setInterval(() => {
      verifyFaces()
    }, 500)
  }

  // Stop realtime verification
  const stopRealtimeVerification = () => {
    if (verificationIntervalRef.current) {
      clearInterval(verificationIntervalRef.current)
      verificationIntervalRef.current = null
      setIsVerifying(false)
      setDebugInfo("Real-time verification stopped")
    }
  }

  // Toggle realtime verification
  const toggleRealtimeVerification = () => {
    const newValue = !isRealtimeVerification
    setIsRealtimeVerification(newValue)

    if (newValue && uploadedImage && isCameraActive) {
      startRealtimeVerification()
    } else {
      stopRealtimeVerification()
    }
  }

  // Get dominant expression
  const getDominantExpression = (expressions: Record<string, number>) => {
    if (!expressions) return null

    let dominant = { expression: "neutral", value: 0 }

    Object.entries(expressions).forEach(([expression, value]) => {
      if (value > dominant.value) {
        dominant = { expression, value }
      }
    })

    return dominant
  }

  // Verify faces
  const verifyFaces = async () => {
    if (!uploadedImage || !isCameraActive || modelLoadingStatus !== "success") {
      setDebugInfo("Cannot verify: missing image, inactive camera, or models not loaded")
      return
    }

    // Don't set isVerifying here for realtime mode to avoid UI flicker
    if (!isRealtimeVerification) {
      setIsVerifying(true)
      setVerificationResult({
        isMatch: null,
        confidence: null,
        message: "Analyzing faces...",
      })
    }

    setErrorMessage(null)

    try {
      // Get face descriptors from uploaded image
      if (!uploadedImageRef.current) {
        setDebugInfo("Uploaded image reference not available")
        return
      }

      const uploadedFaceDetections = await faceapi
          .detectAllFaces(uploadedImageRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors()

      if (uploadedFaceDetections.length === 0) {
        setVerificationResult({
          isMatch: false,
          confidence: null,
          message: "No face detected in the uploaded image.",
        })
        setDebugInfo("No face detected in uploaded image")
        if (!isRealtimeVerification) setIsVerifying(false)
        return
      }

      // Get face descriptors from webcam
      if (!webcamRef.current) {
        setDebugInfo("Webcam reference not available")
        return
      }

      // Detect faces with all attributes (expressions, age, gender)
      const webcamFaceDetections = await faceapi
          .detectAllFaces(webcamRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors()
          .withFaceExpressions()
          .withAgeAndGender()

      if (webcamFaceDetections.length === 0) {
        setVerificationResult({
          isMatch: false,
          confidence: null,
          message: "No face detected in the webcam. Please position yourself clearly in front of the camera.",
        })

        // Reset face attributes
        setFaceAttributes({
          age: null,
          gender: null,
          expressions: null,
        })

        // Clear canvas and draw "No face detected" text
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d")
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

            // Draw background for text
            ctx.fillStyle = "rgba(255, 0, 0, 0.5)"
            ctx.fillRect(10, 10, 200, 30)

            // Draw text
            ctx.font = "16px Arial"
            ctx.fillStyle = "#fff"
            ctx.fillText("No face detected", 20, 30)
          }
        }

        setDebugInfo("No face detected in webcam")
        if (!isRealtimeVerification) setIsVerifying(false)
        return
      }

      // Update face attributes
      const detectedFace = webcamFaceDetections[0]
      setFaceAttributes({
        age: detectedFace.age,
        gender: detectedFace.gender,
        expressions: detectedFace.expressions,
      })

      // Compare faces
      const faceMatcher = new faceapi.FaceMatcher(uploadedFaceDetections)

      const bestMatch = faceMatcher.findBestMatch(webcamFaceDetections[0].descriptor)
      const confidence = (1 - bestMatch.distance) * 100

      // Draw detection results on canvas
      if (canvasRef.current && webcamRef.current) {
        const displaySize = {
          width: webcamRef.current.videoWidth || 640,
          height: webcamRef.current.videoHeight || 480,
        }

        faceapi.matchDimensions(canvasRef.current, displaySize)

        const detections = await faceapi
            .detectAllFaces(webcamRef.current, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceExpressions()
            .withAgeAndGender()

        const resizedDetections = faceapi.resizeResults(detections, displaySize)

        const ctx = canvasRef.current.getContext("2d")
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

          // Draw face detections
          faceapi.draw.drawDetections(canvasRef.current, resizedDetections)
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections)

          // Draw face expressions
          // faceapi.draw.drawFaceExpressions(canvasRef.current, resizedDetections)

          // Add match status text - make it larger and more visible
          ctx.font = "bold 20px Arial"
          ctx.textBaseline = "top"

          const text = confidence > 40 ? `Match: ${confidence.toFixed(1)}%` : `No match: ${confidence.toFixed(1)}%`
          const textWidth = ctx.measureText(text).width

          // Draw background for text - make it more visible
          ctx.fillStyle = confidence > 40 ? "rgba(0, 255, 0, 0.7)" : "rgba(255, 0, 0, 0.7)"
          ctx.fillRect(10, 10, textWidth + 20, 34)

          // Draw text
          ctx.fillStyle = "#fff"
          ctx.fillText(text, 20, 17)

          // Draw a border around the face with match/no match color
          if (resizedDetections.length > 0) {
            const detection = resizedDetections[0]
            const box = detection.detection.box

            // Draw age and gender
            const ageGenderText = `${Math.round(detection.age)} years, ${detection.gender}`
            const ageGenderWidth = ctx.measureText(ageGenderText).width

            ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
            ctx.fillRect(box.x, box.y - 30, ageGenderWidth + 20, 30)

            ctx.fillStyle = "#fff"
            ctx.fillText(ageGenderText, box.x + 10, box.y - 25)

            // Get dominant expression
            const expressions = detection.expressions
            const dominant = getDominantExpression(expressions)

            if (dominant) {
              const expressionText = `${dominant.expression}: ${(dominant.value * 100).toFixed(0)}%`
              const expressionWidth = ctx.measureText(expressionText).width

              ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
              ctx.fillRect(box.x, box.y + box.height, expressionWidth + 20, 30)

              ctx.fillStyle = "#fff"
              ctx.fillText(expressionText, box.x + 10, box.y + box.height + 5)
            }

            ctx.lineWidth = 3
            ctx.strokeStyle = confidence > 40 ? "rgba(0, 255, 0, 0.7)" : "rgba(255, 0, 0, 0.7)"
            ctx.strokeRect(box.x, box.y, box.width, box.height)
          }
        }
      }

      // Set verification result
      if (confidence > 40) {
        setVerificationResult({
          isMatch: true,
          confidence: confidence,
          message: `Face verified! Confidence: ${confidence.toFixed(2)}%`,
        })
        setDebugInfo(`Match found with confidence: ${confidence.toFixed(2)}%`)
      } else {
        setVerificationResult({
          isMatch: false,
          confidence: confidence,
          message: `Faces don't match. Confidence: ${confidence.toFixed(2)}%`,
        })
        setDebugInfo(`No match. Confidence: ${confidence.toFixed(2)}%`)
      }
    } catch (error) {
      console.error("Error during verification:", error)
      setVerificationResult({
        isMatch: null,
        confidence: null,
        message: "An error occurred during verification.",
      })
      setErrorMessage(`Verification error: ${error instanceof Error ? error.message : String(error)}`)
      setDebugInfo(`Verification error: ${error instanceof Error ? error.message : String(error)}`)
    }

    if (!isRealtimeVerification) setIsVerifying(false)
  }

  // Retry loading models
  const retryLoadModels = () => {
    setModelLoadingStatus("idle")
    setLoadingProgress(0)
    setActiveTab("app")
  }

  // Format expressions for display
  const formatExpressions = (expressions: Record<string, number> | null) => {
    if (!expressions) return []

    return Object.entries(expressions)
        .map(([expression, value]) => ({
          expression,
          value: value * 100,
          formattedValue: `${(value * 100).toFixed(1)}%`,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3) // Only show top 3 expressions
  }

  return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold text-center mb-8">Face Verification System</h1>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "app" | "setup")} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="app">Application</TabsTrigger>
            <TabsTrigger value="setup">Setup Instructions</TabsTrigger>
          </TabsList>

          <TabsContent value="app">
            {modelLoadingStatus === "loading" && (
                <Card className="max-w-md mx-auto">
                  <CardHeader>
                    <CardTitle>Loading Face Recognition Models</CardTitle>
                    <CardDescription>Please wait while we load the necessary models...</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Progress value={loadingProgress} className="h-2 mb-2" />
                    <p className="text-sm text-muted-foreground text-center">{loadingProgress}% complete</p>
                  </CardContent>
                </Card>
            )}

            {modelLoadingStatus === "error" && (
                <Alert variant="destructive" className="max-w-md mx-auto mb-8">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error Loading Models</AlertTitle>
                  <AlertDescription>
                    {errorMessage ||
                        "Failed to load face detection models. Please check the Setup Instructions tab for help."}
                    <div className="flex gap-2 mt-4">
                      <Button variant="outline" className="w-full" onClick={retryLoadModels}>
                        Retry Loading Models
                      </Button>
                      <Button variant="default" className="w-full" onClick={() => setActiveTab("setup")}>
                        View Setup Instructions
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
            )}

            {modelLoadingStatus === "success" && (
                <>
                  <div className="flex items-center justify-center mb-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                          id="realtime-mode"
                          checked={isRealtimeVerification}
                          onCheckedChange={toggleRealtimeVerification}
                      />
                      <Label htmlFor="realtime-mode">Real-time Verification Mode</Label>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <Card>
                      <CardHeader>
                        <CardTitle>Upload Reference Image</CardTitle>
                        <CardDescription>Upload an image containing your face</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div
                            className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center h-64 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                          {uploadedImage ? (
                              <div className="relative w-full h-full">
                                <img
                                    ref={uploadedImageRef}
                                    src={uploadedImage || "/placeholder.svg"}
                                    alt="Uploaded face"
                                    className="w-full h-full object-contain"
                                    crossOrigin="anonymous"
                                />
                              </div>
                          ) : (
                              <>
                                <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground text-center">
                                  Click to upload or drag and drop
                                  <br />
                                  JPG, PNG (max. 5MB)
                                </p>
                              </>
                          )}
                          <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleFileUpload}
                              className="hidden"
                          />
                        </div>

                        <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="mr-2 h-4 w-4" /> Select Image
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Webcam Verification</CardTitle>
                        <CardDescription>
                          {isCameraActive ? "Position your face in the camera" : "Start your webcam to verify your face"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="relative border rounded-lg h-64 bg-black flex items-center justify-center overflow-hidden">
                          {isCameraActive ? (
                              <>
                                <video
                                    key="webcam-video"
                                    ref={webcamRef}
                                    id="webcam-video"
                                    autoPlay
                                    playsInline
                                    muted
                                    onPlay={() => setDebugInfo("Video play event fired")}
                                    onPause={() => setDebugInfo("Video paused")}
                                    onEnded={() => setDebugInfo("Video ended")}
                                    onSuspend={() => setDebugInfo("Video suspended")}
                                    onWaiting={() => setDebugInfo("Video waiting")}
                                    onStalled={() => setDebugInfo("Video stalled")}
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "contain",
                                      position: "absolute",
                                      left: 0,
                                      top: 0,
                                    }}
                                />
                                <canvas
                                    ref={canvasRef}
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      position: "absolute",
                                      objectFit: "contain",
                                      left: 0,
                                      top: 0,
                                      zIndex: 10,
                                    }}
                                />
                              </>
                          ) : (
                              <Camera className="h-10 w-10 text-muted-foreground" />
                          )}
                        </div>
                        {isCameraActive && (
                            <Button
                                variant="secondary"
                                className="absolute top-2 right-2 z-20"
                                onClick={() => {
                                  if (webcamRef.current) {
                                    webcamRef.current
                                        .play()
                                        .then(() => setDebugInfo("Manual play successful"))
                                        .catch((err) => setDebugInfo(`Manual play failed: ${err}`))
                                  }
                                }}
                            >
                              Force Play
                            </Button>
                        )}

                        <div className="flex gap-2">
                          {!isCameraActive ? (
                              <Button className="w-full" onClick={startWebcam}>
                                <Camera className="mr-2 h-4 w-4" /> Start Camera
                              </Button>
                          ) : (
                              <>
                                <Button variant="outline" className="w-full" onClick={stopWebcam}>
                                  Stop Camera
                                </Button>
                                <Button variant="secondary" className="w-full" onClick={restartWebcam}>
                                  <RefreshCw className="mr-2 h-4 w-4" /> Restart Camera
                                </Button>
                                {!isRealtimeVerification && (
                                    <Button className="w-full" onClick={verifyFaces} disabled={!uploadedImage || isVerifying}>
                                      {isVerifying ? (
                                          <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying
                                          </>
                                      ) : (
                                          <>Verify Face</>
                                      )}
                                    </Button>
                                )}
                                {isRealtimeVerification && uploadedImage && (
                                    <Button
                                        className="w-full"
                                        onClick={() => {
                                          if (verificationIntervalRef.current) {
                                            stopRealtimeVerification()
                                          } else {
                                            startRealtimeVerification()
                                          }
                                        }}
                                        variant={verificationIntervalRef.current ? "destructive" : "default"}
                                    >
                                      {verificationIntervalRef.current ? (
                                          <>
                                            <X className="mr-2 h-4 w-4" /> Stop Verification
                                          </>
                                      ) : (
                                          <>
                                            <RefreshCw className="mr-2 h-4 w-4" /> Start Verification
                                          </>
                                      )}
                                    </Button>
                                )}
                              </>
                          )}
                        </div>

                        {/* Face attributes display */}
                        {faceAttributes.age !== null && (
                            <div className="mt-4 p-3 border rounded-md bg-muted/30">
                              <h3 className="text-sm font-medium mb-2">Face Attributes</h3>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-xs text-muted-foreground">Age</p>
                                  <p className="font-medium">{Math.round(faceAttributes.age)} years</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Gender</p>
                                  <p className="font-medium">{faceAttributes.gender}</p>
                                </div>
                              </div>

                              <div className="mt-2">
                                <p className="text-xs text-muted-foreground mb-1">Expressions</p>
                                <div className="flex flex-wrap gap-1">
                                  {formatExpressions(faceAttributes.expressions).map((exp) => (
                                      <Badge
                                          key={exp.expression}
                                          variant={exp.value > 50 ? "default" : "outline"}
                                          className="text-xs"
                                      >
                                        {exp.expression}: {exp.formattedValue}
                                      </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                        )}

                        {/* Debug info */}
                        <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded-md">
                          <p>
                            Status: {isCameraActive ? "Camera active" : "Camera inactive"} |
                            {verificationIntervalRef.current ? " Verification running" : " Verification stopped"}
                          </p>
                          <p>Debug: {debugInfo}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
            )}

            {errorMessage && modelLoadingStatus !== "error" && (
                <Alert variant="destructive" className="max-w-md mx-auto mt-8">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            )}

            {verificationResult.message && !isRealtimeVerification && (
                <Alert
                    className="max-w-md mx-auto mt-8"
                    variant={verificationResult.isMatch === true ? "default" : "destructive"}
                >
                  {verificationResult.isMatch === true ? (
                      <Check className="h-4 w-4" />
                  ) : verificationResult.isMatch === false ? (
                      <X className="h-4 w-4" />
                  ) : (
                      <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  <AlertTitle>
                    {verificationResult.isMatch === true
                        ? "Verification Successful"
                        : verificationResult.isMatch === false
                            ? "Verification Failed"
                            : "Processing"}
                  </AlertTitle>
                  <AlertDescription>{verificationResult.message}</AlertDescription>
                </Alert>
            )}
          </TabsContent>

          <TabsContent value="setup">
            <Card className="max-w-3xl mx-auto">
              <CardHeader>
                <CardTitle>Setup Instructions</CardTitle>
                <CardDescription>Follow these steps to set up the face-api.js models</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Model Files Missing</AlertTitle>
                  <AlertDescription>
                    The application requires face-api.js model files to be placed in the correct location.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Option 1: Manual Setup</h3>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>
                      Create a folder named <code className="bg-muted px-1 py-0.5 rounded">models</code> in your{" "}
                      <code className="bg-muted px-1 py-0.5 rounded">public</code> directory
                    </li>
                    <li>
                      Download the following files from the{" "}
                      <a
                          href="https://github.com/justadudewhohacks/face-api.js/tree/master/weights"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                      >
                        face-api.js GitHub repository
                      </a>
                      :
                    </li>
                    <ul className="list-disc pl-5 space-y-1 mt-2">
                      <li>
                        <code className="bg-muted px-1 py-0.5 rounded">
                          tiny_face_detector_model-weights_manifest.json
                        </code>
                      </li>
                      <li>
                        <code className="bg-muted px-1 py-0.5 rounded">tiny_face_detector_model-shard1</code>
                      </li>
                      <li>
                        <code className="bg-muted px-1 py-0.5 rounded">face_landmark_68_model-weights_manifest.json</code>
                      </li>
                      <li>
                        <code className="bg-muted px-1 py-0.5 rounded">face_landmark_68_model-shard1</code>
                      </li>
                      <li>
                        <code className="bg-muted px-1 py-0.5 rounded">face_recognition_model-weights_manifest.json</code>
                      </li>
                      <li>
                        <code className="bg-muted px-1 py-0.5 rounded">face_recognition_model-shard1</code>
                      </li>
                      <li>
                        <code className="bg-muted px-1 py-0.5 rounded">face_recognition_model-shard2</code>
                      </li>
                      <li>
                        <code className="bg-muted px-1 py-0.5 rounded">face_expression_model-weights_manifest.json</code>
                      </li>
                      <li>
                        <code className="bg-muted px-1 py-0.5 rounded">face_expression_model-shard1</code>
                      </li>
                      <li>
                        <code className="bg-muted px-1 py-0.5 rounded">age_gender_model-weights_manifest.json</code>
                      </li>
                      <li>
                        <code className="bg-muted px-1 py-0.5 rounded">age_gender_model-shard1</code>
                      </li>
                    </ul>
                    <li>
                      Place all these files in the <code className="bg-muted px-1 py-0.5 rounded">public/models</code>{" "}
                      directory
                    </li>
                  </ol>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Option 2: Using CDN (Quick Fix)</h3>
                  <p>
                    If you're having trouble with the local model files, you can modify the code to use models from a CDN:
                  </p>
                  <div className="bg-muted p-4 rounded-md">
                    <p className="font-mono text-sm">
                      Change the MODEL_URL from "/models" to:
                      <br />
                      "https://justadudewhohacks.github.io/face-api.js/models"
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Note: Using a CDN may affect performance and reliability if the CDN is down.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Option 3: Using a Script</h3>
                  <p>Create a script to download the model files automatically:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>
                      Create a file named <code className="bg-muted px-1 py-0.5 rounded">download-models.js</code> in your
                      project
                    </li>
                    <li>Copy the script code from the provided example</li>
                    <li>
                      Run the script with Node.js:{" "}
                      <code className="bg-muted px-1 py-0.5 rounded">node download-models.js</code>
                    </li>
                  </ol>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Troubleshooting</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>
                      Make sure the model files are in the correct location (
                      <code className="bg-muted px-1 py-0.5 rounded">public/models/</code>)
                    </li>
                    <li>Check that all required files are present</li>
                    <li>Verify that the files are not corrupted (try re-downloading them)</li>
                    <li>Make sure you're using a compatible version of face-api.js (v0.22.2 is recommended)</li>
                    <li>If your webcam isn't showing, check browser permissions and try a different browser</li>
                  </ul>
                </div>

                <Button className="w-full" onClick={retryLoadModels}>
                  <Loader2 className="mr-2 h-4 w-4" /> Try Loading Models Again
                </Button>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => setActiveTab("app")}>
                  Back to Application
                </Button>
                <Button variant="default" asChild>
                  <a
                      href="https://github.com/justadudewhohacks/face-api.js/tree/master/weights"
                      target="_blank"
                      rel="noopener noreferrer"
                  >
                    <Download className="mr-2 h-4 w-4" /> Download Model Files
                  </a>
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>

        {activeTab === "app" && (
            <div className="mt-8 max-w-2xl mx-auto">
              <Separator className="my-4" />
              <h2 className="text-lg font-semibold mb-2">How to use:</h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Upload a clear image of your face as the reference image</li>
                <li>Start your webcam</li>
                <li>Position yourself clearly in front of the camera</li>
                <li>
                  {isRealtimeVerification
                      ? "The system will automatically verify your face in real-time"
                      : 'Click "Verify Face" to check if the faces match'}
                </li>
              </ol>

              <h2 className="text-lg font-semibold mt-6 mb-2">Face Attributes Detection:</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>The system now detects age, gender, and facial expressions</li>
                <li>Expressions are analyzed in real-time (happy, sad, angry, surprised, etc.)</li>
                <li>Age and gender estimates are approximate and based on visual cues only</li>
                <li>All processing happens locally in your browser - no data is sent to any server</li>
              </ul>

              <h2 className="text-lg font-semibold mt-6 mb-2">Troubleshooting Webcam Issues:</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Make sure you've granted camera permissions to the browser</li>
                <li>Try using a different browser (Chrome or Firefox recommended)</li>
                <li>Ensure good lighting for better face detection</li>
                <li>Check that no other applications are using your camera</li>
                <li>If you can't see your face, try refreshing the page</li>
              </ul>

              <p className="text-sm text-muted-foreground mt-4">
                Note: This application uses face-api.js to perform face detection and recognition directly in your browser.
                No images are sent to any server.
              </p>
            </div>
        )}
      </div>
  )
}
