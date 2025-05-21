---
title: Data Science Dashboard
description: An ML tool that compares a photo with what's being captured by the camera to check the possibility of a match, this can be used for security and enforcement.
date: 2025-04-8
image:  
category: Development
site: https://mlcam.eejay.me
author:
 name: Juan Carlos de Borja
 role: Developer and Author
 avatar: https://github.com/ttv-voidgg.png  
---

# Face Match: Webcam vs Uploaded Image

A browser-based machine learning tool that compares an uploaded photo with what's being captured by your webcam in real-time. Designed for potential applications in security, verification, and enforcement.

🔗 **Live Demo**: [https://mlcam.eejay.me/](https://mlcam.eejay.me/)

---

## 🚀 Features

- **Real-Time Face Verification** – Match a static image with webcam feed.
- **Facial Attribute Detection** – Detects age, gender, and expressions.
- **Client-Side Processing** – All ML tasks run entirely in your browser.
- **Built with TensorFlow.js & face-api.js** – No backend needed.

---

## 📸 How It Works

1. Upload a **reference image** (clear face image).
2. Allow webcam access when prompted.
3. Position your face in the camera view.
4. The tool compares the live feed to the uploaded image and shows the match status.

---

## 🧠 Technology Stack

- [TensorFlow.js](https://www.tensorflow.org/js) – ML in the browser
- [face-api.js](https://github.com/justadudewhohacks/face-api.js) – Face detection and recognition
- HTML5, JavaScript (ES6+), and WebRTC

---

## 🔐 Privacy First

- **100% Local** – No image or data ever leaves your device.
- **No Server Communication** – Everything runs in-browser.

---

## 🛠️ Troubleshooting

- Ensure browser has webcam permissions.
- Use a modern browser like Chrome or Firefox.
- Make sure your face is well-lit and facing forward.
