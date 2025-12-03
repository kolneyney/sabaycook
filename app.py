from flask import Flask, request, jsonify, render_template
import os, torch, json
from torchvision import transforms
from PIL import Image
from flask import send_from_directory
from dotenv import load_dotenv
load_dotenv() 

app = Flask(__name__)
# Get the folder where this Flask app file is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Set uploads folder inside the project folder
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# -----------------------------
# Load Model
# -----------------------------
model_path = os.path.join(BASE_DIR, "fruit_veg_classifier_2.pth")  # or "models/fruit_veg_classifier_2.pth"
model = torch.load(model_path, map_location="cpu", weights_only=False)
model.eval()

classes = [
    'apple', 'banana', 'beetroot', 'bell pepper', 'cabbage', 'capsicum',
    'carrot', 'cauliflower', 'chilli pepper', 'corn', 'cucumber', 'eggplant',
    'garlic', 'ginger', 'grapes', 'jalepeno', 'kiwi', 'lemon', 'lettuce', 
    'mango', 'not ingredient', 'onion', 'orange', 'paprika', 'pear', 'peas', 
    'pineapple', 'pomegranate', 'potato', 'raddish', 'soy beans', 'spinach', 
    'sweetcorn', 'sweetpotato', 'tomato', 'turnip', 'watermelon'
]

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# -----------------------------
# Ingredient Prediction
# -----------------------------
def predict_image(path, threshold=0.5):
    img = Image.open(path).convert("RGB")
    img_tensor = transform(img).unsqueeze(0)

    with torch.no_grad():
        outputs = model(img_tensor)
        probs = torch.softmax(outputs, dim=1)
        confidence, predicted = torch.max(probs, 1)

    if confidence.item() < threshold:
        return "No ingredient detected"
    else:
        return classes[predicted.item()]

# -----------------------------
# Load Recipes
# -----------------------------
recipes = []
recipes_file = os.path.join(BASE_DIR, "recipes.json")
with open(recipes_file, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line:
            try:
                recipes.append(json.loads(line))
            except:
                print("Invalid JSON ignored:", line)

# -----------------------------
# Match Recipes
# -----------------------------
def match_recipes(ingredients, recipes):
    ingredients = [i.lower() for i in ingredients if i != "No ingredient detected"]
    matches = []

    for recipe in recipes:
        full_text = " ".join(recipe.get("ingredients", [])).lower()
        score = sum(1 for ing in ingredients if ing in full_text)

        if score > 0:
            matches.append({
                "recipe_title": recipe["recipe_title"],
                "score": score,
                "ingredients": recipe["ingredients"],
                "directions": recipe["directions"]
            })

    matches.sort(key=lambda x: x["score"], reverse=True)
    return matches

# -----------------------------
# REMOVE OpenAI Image Generation
# -----------------------------
def generate_food_image(recipe_title, ingredients, instructions):
    # Instead of generating an AI image, return placeholder
    return "uploads/placeholder.png"


# -----------------------------
# ROUTES
# -----------------------------
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/upload_page")
def upload_page():
    return render_template("main.html")

@app.route("/upload", methods=["POST"])
def upload_images():
    if "images" not in request.files:
        return jsonify({"error": "No images uploaded"}), 400

    files = request.files.getlist("images")
    detected_all = []

    for file in files:
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], file.filename)
        file.save(filepath)
        detected = predict_image(filepath)
        detected_all.append(detected)

    return jsonify({"detectedIngredients": detected_all})

@app.route("/recommend", methods=["POST"])
def recommend():
    data = request.json
    ingredients = data.get("ingredients", [])
    meats = data.get("meat", [])

    # Add meats to ingredient list
    for m in meats:
        if m.lower() != "none":
            ingredients.append(m.lower())

    ingredients = list(set(ingredients))

    matches = match_recipes(ingredients, recipes)

    if not matches:
        return jsonify({
            "detected": ingredients,
            "recommended": [],
            "message": "No matching recipes found."
        })

    # -------- Return TOP 3-5 recipes --------
    top_n = 5
    top_recipes = matches[:top_n]

    recommended_results = []
    for recipe in top_recipes:
        image_path = generate_food_image(
            recipe["recipe_title"],
            recipe["ingredients"],
            recipe["directions"]
        )
        image_url = f"/uploads/{os.path.basename(image_path)}"
        recommended_results.append({
            "recipe_title": recipe["recipe_title"],
            "score": recipe["score"],
            "ingredients": recipe["ingredients"],
            "instructions": recipe["directions"],
            "image": image_url
        })

    return jsonify({
        "detected": ingredients,
        "recommended": recommended_results
    })


@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == "__main__":
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(debug=True)
