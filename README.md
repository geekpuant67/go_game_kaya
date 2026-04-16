# Go Game (with AI)

19x19 Go game. It's basically a simple web UI hooked up to a real AI running locally on Python. 

## What's inside:
- A clickable board made with JavaScript (Canvas).
- A Python (Flask) backend tying everything together.
- The "Kaya" AI model playing the white stones (grabbed from Hugging Face).
- A custom scoring algorithm.

## How to run it on your machine:

**1. Get the code**
clone the repo or download the zip:
\`\`\`bash
git clone https://github.com/geekpuant67/go_game_kaya.git
cd go_game_kaya
\`\`\`

**2. Install the requirements**
Make sure you have Python, then run:
\`\`\`bash
pip install flask flask-cors onnxruntime numpy
\`\`\`

**3. Grab the AI brain**
The model file is 280MB, which was too big for GitHub. Need to download it manually:
- Go to: [Kaya on Hugging Face](https://huggingface.co/kaya-go/kaya/tree/main/kata1-b28c512nbt-adam-s11165M-d5387M)
- Download the `kaya-9.fp32.onnx` file.
- Drop it in the main folder of this project and rename it to **`model.onnx`**.

**4. Play**
Spin up the backend:
\`\`\`bash
python app.py
\`\`\`
Then just double-click `index.html` to open it in your browser.
