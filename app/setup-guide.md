# Face-API.js Setup Guide

This guide will help you set up the face-api.js models correctly to avoid tensor shape errors.

## Model Files

You need to download the following model files and place them in the `/public/models/` directory:

### Tiny Face Detector
- `tiny_face_detector_model-weights_manifest.json`
- `tiny_face_detector_model-shard1`

### Face Landmark Detection
- `face_landmark_68_model-weights_manifest.json`
- `face_landmark_68_model-shard1`

### Face Recognition
- `face_recognition_model-weights_manifest.json`
- `face_recognition_model-shard1`
- `face_recognition_model-shard2`

### Face Expression
- `face_expression_model-weights_manifest.json`
- `face_expression_model-shard1`

## Automatic Download

You can use the provided `download-models.js` script to automatically download all required model files:

\`\`\`bash
node app/download-models.js
\`\`\`

## Manual Download

If you prefer to download the files manually, you can get them from the official face-api.js GitHub repository:

1. Go to: https://github.com/justadudewhohacks/face-api.js/tree/master/weights
2. Download each file listed above
3. Place them in your project's `/public/models/` directory

## Troubleshooting

If you encounter tensor shape errors like:
\`\`\`
Error: Based on the provided shape, [3,3,3,16], the tensor should have 432 values but has 220
\`\`\`

This usually means:

1. The model files are incomplete or corrupted
2. You're missing some of the required model files
3. There's a version mismatch between face-api.js and the model files

Solutions:
- Make sure you have ALL the required model files
- Try re-downloading the model files
- Check that you're using a compatible version of face-api.js (v0.22.2 is recommended)
- Verify the model files are in the correct location (/public/models/)
