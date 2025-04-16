"use client"

import { useEffect, useRef, useState } from "react"
import * as faceapi from "face-api.js"

// This is an alternative version that uses CDN for model files
export default function FaceVerificationCDN() {
    const [modelLoadingStatus, setModelLoadingStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
    const [loadingProgress, setLoadingProgress] = useState(0)
    const [uploadedImage, setUploadedImage] = useState<string | null>(null)
    const [isCameraActive, setIsCameraActive] = useState(false)
    const [isVerifying, setIsVerifying] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
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

    // Load face-api models from CDN
    useEffect(() => {
        const loadModels = async () => {
            try {
                setModelLoadingStatus("loading")
                setErrorMessage(null)

                // Use CDN URL for models
                const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models"

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
                setLoadingProgress(40)

                await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
                setLoadingProgress(70)

                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                setLoadingProgress(90)

                await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
                setLoadingProgress(100)

                setModelLoadingStatus("success")
            } catch (error) {
                console.error("Error loading models:", error)
                setModelLoadingStatus("error")
                setErrorMessage(
                    `Failed to load face detection models: ${error instanceof Error ? error.message : String(error)}`,
                )
            }
        }

        loadModels()

        // Cleanup function
        return () => {
            if (webcamRef.current && webcamRef.current.srcObject) {
                const stream = webcamRef.current.srcObject as MediaStream
                const tracks = stream.getTracks()
                tracks.forEach((track) => track.stop())
            }
        }
    }, [])

    // Rest of the component remains the same...
    // (Omitted for brevity - this would be identical to the main component)

    return (
        <div>
            {/* Component UI would be here */}
            <p>This is a placeholder for the CDN version of the component.</p>
        </div>
    )
}
