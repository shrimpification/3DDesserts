import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Modal functionality
const modal = document.getElementById('product-modal');
const modalClose = document.getElementById('modal-close');
const productCards = document.querySelectorAll('.product-card');

let modalScene = null;
let modalCamera = null;
let modalRenderer = null;
let modalControls = null;
let modalModel = null;
let currentModalModelPath = null;

// Open modal
function openModal(productData) {
    document.getElementById('modal-product-name').textContent = productData.name;
    document.getElementById('modal-product-price').textContent = productData.price;
    document.getElementById('modal-product-description').textContent = productData.description;
    
    // Update features list
    const featuresList = document.getElementById('modal-features-list');
    featuresList.innerHTML = '';
    productData.features.forEach(feature => {
        const li = document.createElement('li');
        li.textContent = feature;
        featuresList.appendChild(li);
    });

    // Show/hide 3D viewer or image
    const modal3DViewer = document.getElementById('modal-3d-viewer');
    const modalImagePlaceholder = document.getElementById('modal-image-placeholder');
    
    if (productData.has3D && productData.modelPath) {
        modal3DViewer.style.display = 'block';
        modalImagePlaceholder.style.display = 'none';
        currentModalModelPath = productData.modelPath;
        initModal3DViewer(productData.modelPath);
    } else {
        modal3DViewer.style.display = 'none';
        modalImagePlaceholder.style.display = 'block';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Clean up 3D viewer
    if (modalRenderer) {
        modalRenderer.dispose();
        modalRenderer = null;
    }
    if (modalControls) {
        modalControls.dispose();
        modalControls = null;
    }
    modalScene = null;
    modalCamera = null;
    modalModel = null;
}

// Event listeners
productCards.forEach(card => {
    card.addEventListener('click', (e) => {
        // Don't open modal if clicking bookmark icon
        if (e.target.classList.contains('bookmark-icon') || e.target.closest('.bookmark-icon')) {
            return;
        }
        const productData = JSON.parse(card.getAttribute('data-product'));
        openModal(productData);
    });
});

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
    }
});

// Initialize 3D viewer in modal
function initModal3DViewer(modelPath) {
    // Clean up existing viewer if any
    if (modalRenderer) {
        modalRenderer.dispose();
        modalRenderer = null;
    }
    if (modalControls) {
        modalControls.dispose();
        modalControls = null;
    }
    if (modalModel && modalScene) {
        modalScene.remove(modalModel);
        modalModel = null;
    }
    
    const container = document.getElementById('modal-3d-viewer');
    const canvas = document.getElementById('modal-three-canvas');
    
    if (!container || !canvas || !modelPath) return;

    // Wait a bit for the container to be visible and have dimensions
    setTimeout(() => {
        const width = container.clientWidth || 500;
        const height = container.clientHeight || 500;

        // Scene setup
        modalScene = new THREE.Scene();
        modalScene.background = new THREE.Color(0xE8E8E8);

        // Camera setup
        modalCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        modalCamera.position.set(0, 0, 5);

        // Renderer setup
        modalRenderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        modalRenderer.setSize(width, height);
        modalRenderer.setPixelRatio(window.devicePixelRatio);
        modalRenderer.shadowMap.enabled = true;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        modalScene.add(ambientLight);

        const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight1.position.set(5, 5, 5);
        modalScene.add(directionalLight1);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight2.position.set(-5, 3, -5);
        modalScene.add(directionalLight2);

        // Controls
        modalControls = new OrbitControls(modalCamera, modalRenderer.domElement);
        modalControls.enableDamping = true;
        modalControls.dampingFactor = 0.05;
        modalControls.minDistance = 2;
        modalControls.maxDistance = 10;
        modalControls.enableZoom = true;
        modalControls.enablePan = false;

        // Load GLB model
        const loader = new GLTFLoader();
        loader.load(
            modelPath,
            (gltf) => {
                modalModel = gltf.scene.clone();
                
                const box = new THREE.Box3().setFromObject(modalModel);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                
                modalModel.position.x = -center.x;
                modalModel.position.y = -center.y;
                modalModel.position.z = -center.z;
                
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 2 / maxDim;
                modalModel.scale.multiplyScalar(scale);
                
                modalScene.add(modalModel);
                
                const newBox = new THREE.Box3().setFromObject(modalModel);
                const newSize = newBox.getSize(new THREE.Vector3());
                const maxSize = Math.max(newSize.x, newSize.y, newSize.z);
                modalCamera.position.set(0, 0, maxSize * 2);
                modalControls.update();
            },
            undefined,
            (error) => {
                console.error('Error loading modal model:', error);
            }
        );

        // Animation loop
        function animate() {
            if (!modalRenderer || !modalScene || !modalCamera) return;
            requestAnimationFrame(animate);
            if (modalControls) modalControls.update();
            modalRenderer.render(modalScene, modalCamera);
        }
        animate();

        // Handle resize
        function handleResize() {
            if (!container || !modalCamera || !modalRenderer) return;
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;
            
            modalCamera.aspect = newWidth / newHeight;
            modalCamera.updateProjectionMatrix();
            modalRenderer.setSize(newWidth, newHeight);
        }

        window.addEventListener('resize', handleResize);
        handleResize();
    }, 100);
}

// Initialize 3D viewer for a product card
function initProduct3DViewer(canvasId, containerId, modelPath) {
    const canvas = document.getElementById(canvasId);
    const container = document.getElementById(containerId);

    if (!canvas) {
        console.error(`Canvas element not found: ${canvasId}`);
        return;
    }
    
    if (!container) {
        console.error(`Container element not found: ${containerId}`);
        return;
    }
    
    if (!modelPath) {
        console.error(`Model path not provided for ${containerId}`);
        return;
    }

    console.log(`Initializing 3D viewer: ${containerId} with model: ${modelPath}`);

    // Wait for container to have dimensions
    const checkDimensions = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        if (width === 0 || height === 0) {
            console.warn(`Container ${containerId} has zero dimensions, retrying...`);
            setTimeout(checkDimensions, 100);
            return;
        }
        
        initializeViewer(width, height);
    };
    
    const initializeViewer = (width, height) => {
        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xE8E8E8);

        // Camera setup
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(0, 0, 5);

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight1.position.set(5, 5, 5);
        scene.add(directionalLight1);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight2.position.set(-5, 3, -5);
        scene.add(directionalLight2);

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 2;
        controls.maxDistance = 10;
        controls.enableZoom = true;
        controls.enablePan = false;

        // Load GLB model
        const loader = new GLTFLoader();
        
        loader.load(
            modelPath,
            (gltf) => {
                console.log(`Successfully loaded model: ${modelPath}`);
                const model = gltf.scene;
                
                // Calculate bounding box to center the model
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                
                // Center the model
                model.position.x = -center.x;
                model.position.y = -center.y;
                model.position.z = -center.z;
                
                // Scale model to fit nicely in the view
                const maxDim = Math.max(size.x, size.y, size.z);
                if (maxDim > 0) {
                    const scale = 2 / maxDim;
                    model.scale.multiplyScalar(scale);
                } else {
                    console.warn(`Model ${modelPath} has zero dimensions, using default scale`);
                    model.scale.set(1, 1, 1);
                }
                
                scene.add(model);
                
                // Adjust camera to view the model
                const newBox = new THREE.Box3().setFromObject(model);
                const newSize = newBox.getSize(new THREE.Vector3());
                const maxSize = Math.max(newSize.x, newSize.y, newSize.z);
                if (maxSize > 0) {
                    camera.position.set(0, 0, maxSize * 2);
                } else {
                    camera.position.set(0, 0, 5);
                }
                controls.update();
                console.log(`Model ${modelPath} added to scene successfully`);
            },
            (progress) => {
                if (progress.lengthComputable) {
                    const percentComplete = (progress.loaded / progress.total) * 100;
                    console.log(`Loading ${modelPath}: ${percentComplete.toFixed(2)}%`);
                }
            },
            (error) => {
                console.error(`Error loading model ${modelPath}:`, error);
                // Clear the scene and show a simple background
                scene.background = new THREE.Color(0xE8E8E8);
                renderer.render(scene, camera);
            }
        );

        // Animation loop
        function animate() {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        }
        animate();

        // Handle window resize
        function handleResize() {
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;
            
            if (newWidth > 0 && newHeight > 0) {
                camera.aspect = newWidth / newHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(newWidth, newHeight);
            }
        }

        window.addEventListener('resize', handleResize);
    };
    
    // Start checking dimensions
    checkDimensions();
}

// Initialize all product 3D viewers
function initAllProductViewers() {
    // Ensure productCards is available
    const cards = document.querySelectorAll('.product-card');
    if (!cards || cards.length === 0) {
        console.error('Product cards not found');
        return;
    }
    
    // Get product data and initialize each viewer
    cards.forEach((card, index) => {
        try {
            const productData = JSON.parse(card.getAttribute('data-product'));
            if (productData.has3D && productData.modelPath) {
                const canvasId = `three-canvas-${index + 1}`;
                const containerId = `product-3d-viewer-${index + 1}`;
                console.log(`Initializing 3D viewer ${index + 1} with model: ${productData.modelPath}`);
                initProduct3DViewer(canvasId, containerId, productData.modelPath);
            }
        } catch (error) {
            console.error(`Error parsing product data for card ${index + 1}:`, error);
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            requestAnimationFrame(initAllProductViewers);
        }, 100);
    });
} else {
    setTimeout(() => {
        requestAnimationFrame(initAllProductViewers);
    }, 100);
}

