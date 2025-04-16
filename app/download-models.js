// This is a helper script to download the face-api.js model files
// Run this script with Node.js to download the model files to your public/models directory

const fs = require("fs")
const path = require("path")
const https = require("https")

// Create models directory if it doesn't exist
const modelsDir = path.join(__dirname, "../public/models")
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true })
}

// Model files to download
const modelFiles = [
    {
        url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-weights_manifest.json",
        filename: "tiny_face_detector_model-weights_manifest.json",
    },
    {
        url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-shard1",
        filename: "tiny_face_detector_model-shard1",
    },
    {
        url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-weights_manifest.json",
        filename: "face_landmark_68_model-weights_manifest.json",
    },
    {
        url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-shard1",
        filename: "face_landmark_68_model-shard1",
    },
    {
        url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-weights_manifest.json",
        filename: "face_recognition_model-weights_manifest.json",
    },
    {
        url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard1",
        filename: "face_recognition_model-shard1",
    },
    {
        url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard2",
        filename: "face_recognition_model-shard2",
    },
    {
        url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_expression_model-weights_manifest.json",
        filename: "face_expression_model-weights_manifest.json",
    },
    {
        url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_expression_model-shard1",
        filename: "face_expression_model-shard1",
    },
]

// Download function
function downloadFile(url, filename) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(modelsDir, filename)
        const file = fs.createWriteStream(filePath)

        https
            .get(url, (response) => {
                response.pipe(file)

                file.on("finish", () => {
                    file.close()
                    console.log(`Downloaded: ${filename}`)
                    resolve()
                })
            })
            .on("error", (err) => {
                fs.unlink(filePath, () => {}) // Delete the file if there's an error
                console.error(`Error downloading ${filename}: ${err.message}`)
                reject(err)
            })
    })
}

// Download all model files
async function downloadAllModels() {
    console.log("Starting download of face-api.js model files...")

    for (const model of modelFiles) {
        try {
            await downloadFile(model.url, model.filename)
        } catch (error) {
            console.error(`Failed to download ${model.filename}`)
        }
    }

    console.log("All model files downloaded successfully!")
}

downloadAllModels()
