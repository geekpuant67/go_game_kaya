import onnxruntime as ort
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# --- I MODELE LOADING ---
try:
    session = ort.InferenceSession("model.onnx", providers=['CPUExecutionProvider'])
    print("AI KAYA and Referee Loaded and Ready")
except Exception as e:
    print(f"Error loading : {e}")


# --- II TACTICAL RULES ---

def count_liberties(board, x, y, color, size=9):
    visited = set()
    stack = [(x, y)]
    liberties = set()
    while stack:
        cx, cy = stack.pop()
        if (cx, cy) in visited: continue
        visited.add((cx, cy))
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < size and 0 <= ny < size:
                if board[nx][ny] is None: liberties.add((nx, ny))
                elif board[nx][ny] == color: stack.append((nx, ny))
    return len(liberties)

def find_capture_move(board, size=9):
    """ Looking for capture move """
    for r in range(size):
        for c in range(size):
            if board[r][c] is None:
                board[r][c] = 'white'
                captured = False
                for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < size and 0 <= nc < size and board[nr][nc] == 'black':
                        if count_liberties(board, nr, nc, 'black', size) == 0:
                            captured = True
                            break
                board[r][c] = None
                if captured: return r, c
    return None

def is_suicide(board, x, y, color, size=9):
    board[x][y] = color
    libs = count_liberties(board, x, y, color, size)
    board[x][y] = None
    return libs == 0

def get_territory(board, size=9):
    """ Flood Fill algorithm to count (Referee) """
    visited = set()
    black_t, white_t = 0, 0
    for r in range(size):
        for c in range(size):
            if board[r][c] is None and (r, c) not in visited:
                group, stack = [], [(r, c)]
                reached_colors = set()
                while stack:
                    curr_r, curr_c = stack.pop()
                    if (curr_r, curr_c) in visited: continue
                    visited.add((curr_r, curr_c))
                    group.append((curr_r, curr_c))
                    for dr, dc in [(-1,0), (1,0), (0,-1), (0,1)]:
                        nr, nc = curr_r + dr, curr_c + dc
                        if 0 <= nr < size and 0 <= nc < size:
                            if board[nr][nc] is None: stack.append((nr, nc))
                            else: reached_colors.add(board[nr][nc])
                if len(reached_colors) == 1:
                    color = reached_colors.pop()
                    if color == 'black': black_t += len(group)
                    elif color == 'white': white_t += len(group)
    return black_t, white_t


# --- III API ROUTES ---

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    board = data['board']
    size = int(data.get('size', 9))

    # 1 capture move
    capture = find_capture_move(board, size)
    if capture and not is_suicide(board, capture[0], capture[1], 'white', size):
        return jsonify({"status": "success", "x": capture[0], "y": capture[1]})

    # 2 reflexion
    input_dict = {}
    for model_input in session.get_inputs():
        shape = [1 if (type(dim)==str or dim is None) else dim for dim in model_input.shape]
        if len(shape) == 4: shape[2], shape[3] = size, size
        tensor = np.zeros(shape, dtype=np.float32)
        if model_input.name == 'bin_input':
            for i in range(size):
                for j in range(size):
                    if board[i][j] == 'white': tensor[0, 0, i, j] = 1.0
                    elif board[i][j] == 'black': tensor[0, 1, i, j] = 1.0 if shape[1]>1 else -1.0
        input_dict[model_input.name] = tensor

    outputs = session.run(None, input_dict)
    probabilities = outputs[0].flatten()
    best_indices = np.argsort(probabilities)[::-1]

    empty_spots = sum(1 for row in board for cell in row if cell is None)

    # 3 decision making
    for idx in best_indices:
        if idx == size * size:
            if empty_spots <= 10: 

                return jsonify({"status": "pass", "message": "AI is skipping turn"})
            else:
                continue 

        # basic move
        x, y = divmod(idx, size)
        x, y = int(x), int(y)
        if x < size and y < size and board[x][y] is None:
            if not is_suicide(board, x, y, 'white', size):
                return jsonify({"status": "success", "x": x, "y": y})
    
    return jsonify({"status": "pass"})

@app.route('/score', methods=['POST'])
def calculate_score():
    data = request.json
    board = data['board']
    size = int(data.get('size', 9))
    
    b_stones = sum(row.count('black') for row in board)
    w_stones = sum(row.count('white') for row in board)
    
    b_t, w_t = get_territory(board, size)
    
    komi = 6.5
    total_b = b_stones + b_t
    total_w = w_stones + w_t + komi
    
    return jsonify({
        "black": {"total": total_b, "stones": b_stones, "territory": b_t},
        "white": {"total": total_w, "stones": w_stones, "territory": w_t, "komi": komi},
        "winner": "black" if total_b > total_w else "white"
    })

if __name__ == '__main__':
    app.run(port=5000)