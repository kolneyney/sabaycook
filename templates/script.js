// Global variables
let selectedImages = [];
let selectedMeat = [];

// DOM elements
const imageUpload = document.getElementById("imageUpload");
const imagePreview = document.getElementById("imagePreview");
const detectedOutput = document.getElementById("detectedOutput");
const recommendBtn = document.getElementById("recommendBtn");
const resetBtn = document.getElementById("resetBtn"); // Added reset button

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    
    // Auto-select "None" on page load
    const noneCard = document.querySelector('.meat-card[data-meat="None"]');
    if (noneCard) {
        selectMeatCard(noneCard);
    }
});

function initializeEventListeners() {
    // Image upload and preview
    if (imageUpload) {
        imageUpload.addEventListener("change", handleImageUpload);
    }

    // Meat selection
    initializeMeatSelection();

    // Recommendation button
    if (recommendBtn) {
        recommendBtn.addEventListener("click", handleRecommendation);
    }
    
    // Reset button
    if (resetBtn) {
        resetBtn.addEventListener("click", resetForm);
    }
}

// Helper function to select a meat card
function selectMeatCard(card) {
    card.classList.add("selected");
    card.setAttribute('aria-pressed', 'true');
}

// Helper function to deselect a meat card
function deselectMeatCard(card) {
    card.classList.remove("selected");
    card.setAttribute('aria-pressed', 'false');
}

// Handle image upload and processing
function handleImageUpload() {
    selectedImages = Array.from(imageUpload.files);
    imagePreview.innerHTML = "";

    if (!selectedImages.length) {
        imagePreview.textContent = "No image selected";
        detectedOutput.textContent = "—";
        return;
    }

    // Create image previews
    selectedImages.forEach(file => {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.alt = "Uploaded ingredient";
        imagePreview.appendChild(img);
    });

    // Show loading state
    detectedOutput.textContent = "Detecting ingredients...";

    // Send to server for processing
    const formData = new FormData();
    selectedImages.forEach(img => formData.append("images", img));

    fetch("/upload", {
        method: "POST",
        body: formData
    })
    .then(res => {
        if (!res.ok) {
            throw new Error('Network response was not ok');
        }
        return res.json();
    })
    .then(data => {
        if (data.detectedIngredients && data.detectedIngredients.length > 0) {
            detectedOutput.textContent = data.detectedIngredients.join(", ");
        } else {
            detectedOutput.textContent = "No ingredients detected";
        }
    })
    .catch(error => {
        console.error('Error uploading images:', error);
        detectedOutput.textContent = "Error detecting ingredients";
    });
}

// Initialize meat selection functionality
function initializeMeatSelection() {
    const meatCards = document.querySelectorAll(".meat-card");
    
    meatCards.forEach(card => {
        card.addEventListener("click", handleMeatSelection);
        
        // Add keyboard accessibility
        card.addEventListener("keydown", (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleMeatSelection.call(card, e);
            }
        });
        
        // Set tabindex for accessibility
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-pressed', 'false');
    });
}

// Handle meat selection with enhanced visual feedback - FIXED
function handleMeatSelection(event) {
    const meat = this.dataset.meat;
    const isSelected = this.classList.contains("selected");

    if (meat === "None") {
        // If "None" is clicked
        if (!isSelected) {
            // Select "None" and deselect all others
            clearAllMeatSelections();
            selectMeatCard(this);
            selectedMeat = [];
        } else {
            // FIXED: If "None" was already selected, deselect it
            deselectMeatCard(this);
            selectedMeat = [];
        }
        return;
    }

    // If a meat type is clicked, first deselect "None" if it's selected
    const noneCard = document.querySelector('.meat-card[data-meat="None"]');
    if (noneCard && noneCard.classList.contains("selected")) {
        deselectMeatCard(noneCard);
    }

    // Toggle current meat selection
    if (isSelected) {
        deselectMeatCard(this);
        selectedMeat = selectedMeat.filter(m => m !== meat);
    } else {
        selectMeatCard(this);
        selectedMeat.push(meat);
    }

    // If no meat selected after toggling, auto-select "None"
    if (selectedMeat.length === 0) {
        if (noneCard && !noneCard.classList.contains("selected")) {
            selectMeatCard(noneCard);
        }
    }
}

// Clear all meat selections
function clearAllMeatSelections() {
    document.querySelectorAll(".meat-card").forEach(card => {
        deselectMeatCard(card);
    });
}

// Handle recipe recommendation
function handleRecommendation() {
    const ingredients = detectedOutput.textContent.split(", ").filter(Boolean);
    
    // Validation
    if (ingredients.length === 0 || ingredients[0] === "—" || 
        ingredients[0] === "Detecting ingredients..." || 
        ingredients[0] === "Error detecting ingredients" ||
        ingredients[0] === "No ingredients detected") {
        alert("Please upload images of ingredients first!");
        return;
    }

    // Show loading state
    const recommendOutput = document.getElementById("recommendOutput");
    recommendBtn.disabled = true;
    recommendBtn.innerHTML = '<span class="loading"></span> Finding Recipes...';
    
    recommendOutput.innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
            <div class="loading" style="width: 50px; height: 50px; margin: 0 auto 20px;"></div>
            <h3 style="color: #ff7043; margin-bottom: 15px;">Finding Your Perfect Recipe</h3>
            <p>🔍 Analyzing your ingredients and finding the perfect recipe...</p>
        </div>
    `;

    // Send request to server
    fetch("/recommend", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json" 
        },
        body: JSON.stringify({ 
            ingredients: ingredients, 
            meat: selectedMeat 
        })
    })
    .then(res => {
        if (!res.ok) {
            throw new Error('Network response was not ok');
        }
        return res.json();
    })
    .then(data => {
        displayRecommendation(data);
    })
    .catch(error => {
        console.error('Error getting recommendation:', error);
        recommendOutput.innerHTML = `
            <div class="no-results">
                <h3>❌ Error</h3>
                <p>Unable to get recommendation. Please try again.</p>
                <p><small>${error.message}</small></p>
            </div>
        `;
    })
    .finally(() => {
        recommendBtn.disabled = false;
        recommendBtn.textContent = "Show Recommendation";
    });
}

// Display the recommendation results
function displayRecommendation(data) {
    const recommendOutput = document.getElementById("recommendOutput");
    
    // Check if we have the new format (recommended array) or old format
    if (data.recommended && data.recommended.length > 0) {
        // New format: Show ALL recommended recipes
        let html = "<h2>🍲 Recommended Recipes</h2>";
        
        data.recommended.forEach((recipe, index) => {
            html += `
                <div class="recipe-card">
                    <h3>${recipe.recipe_title || 'Recipe'}</h3>
                    
                    <h4>📋 Ingredients:</h4>
                    <ul>
                        ${(recipe.ingredients || []).map(i => `<li>${i}</li>`).join("")}
                    </ul>
                    
                    <h4>👩‍🍳 Instructions:</h4>
                    <div class="recipe-instructions">
                        <p>${formatInstructions(recipe.instructions || '')}</p>
                    </div>
                    
                    ${index < data.recommended.length - 1 ? '<hr>' : ''}
                </div>
            `;
        });
        
        recommendOutput.innerHTML = html;
        
    } else if (data.recommendedDish && data.recommendedDish !== "No matching recipes found.") {
        // Old format: Single recipe
        const formattedInstructions = formatInstructions(data.details?.instructions || '');
        
        recommendOutput.innerHTML = `
            <h3>🍛 ${data.recommendedDish}</h3>
            ${data.image ? `
                <img src="${data.image}" alt="${data.recommendedDish}" class="food-image">
            ` : ''}
            
            <div style="margin-top: 25px;">
                <h4>📋 Ingredients</h4>
                <ul>
                    ${(data.details?.ingredients || []).map(i => `<li>${i}</li>`).join("")}
                </ul>
            </div>
            
            <div style="margin-top: 25px;">
                <h4>👩‍🍳 Instructions</h4>
                <div class="recipe-instructions">
                    <p>${formattedInstructions}</p>
                </div>
            </div>
            
            <div class="ingredients-summary">
                <p><strong>🎯 Based on your ingredients:</strong> ${data.detected?.join(", ") || 'Your uploaded ingredients'}</p>
            </div>
        `;
    } else {
        // No results
        recommendOutput.innerHTML = `
            <div class="no-results">
                <h3>😞 No Recipe Found</h3>
                <p>We couldn't find a recipe matching your ingredients.</p>
                <p>Try uploading different ingredients or selecting different meat options.</p>
            </div>
        `;
    }
}

// Format instructions with better spacing
function formatInstructions(instructions) {
    if (!instructions || instructions.trim() === '') {
        return 'No instructions available.';
    }
    
    // Replace numbered steps with line breaks
    let formatted = instructions
        .replace(/(\d+\.)/g, '<br><br>$1')  // Add line break before each numbered step
        .replace(/\n\s*\n/g, '<br>')        // Replace multiple line breaks with single
        .trim();
    
    // If no numbers found, try to split by periods
    if (!formatted.includes('<br>')) {
        formatted = instructions
            .split('.')
            .filter(step => step.trim().length > 0)
            .map(step => '<br><br>' + step.trim() + '.')
            .join('');
    }
    
    return formatted;
}

// Utility function to reset the form
function resetForm() {
    selectedImages = [];
    selectedMeat = [];
    
    if (imageUpload) imageUpload.value = '';
    if (imagePreview) imagePreview.innerHTML = 'No image selected';
    if (detectedOutput) detectedOutput.textContent = '—';
    
    clearAllMeatSelections();
    const noneCard = document.querySelector('.meat-card[data-meat="None"]');
    if (noneCard) {
        selectMeatCard(noneCard);
    }
    
    const recommendOutput = document.getElementById("recommendOutput");
    if (recommendOutput) {
        recommendOutput.innerHTML = '<p>Your food recommendation will appear here...</p>';
    }
}

// Add keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        resetForm();
    }
});