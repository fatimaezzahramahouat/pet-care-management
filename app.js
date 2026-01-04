// ===============================
// GLOBAL VARIABLES
// ===============================
let currentService = 'vet';
let currentVille = '';
let currentPetType = 'all';
let allServices = []; // Pour stocker tous les services
const API_URL = 'http://localhost:5000/api';

// ===============================
// SEARCH FUNCTIONS
// ===============================
function filterService(serviceType) {
    currentService = serviceType;
    
    // Update active buttons
    document.querySelectorAll('.btn-group-vertical .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Trouver et activer le bouton cliqué
    const buttons = document.querySelectorAll('.btn-group-vertical .btn');
    buttons.forEach(btn => {
        if (btn.textContent.includes(getServiceTypeLabel(serviceType)) || 
            (serviceType === 'vet' && btn.textContent.includes('Vétérinaires')) ||
            (serviceType === 'all' && btn.textContent.includes('Tous les services'))) {
            btn.classList.add('active');
        }
    });
    
    console.log('Filtre service:', currentService);
    
    // Exécuter la recherche
    searchServices();
}

async function searchServices() {
    const ville = document.getElementById("locationInput").value;
    const petType = document.getElementById("petTypeSelect").value;
    
    currentVille = ville;
    currentPetType = petType;
    
    // Afficher un indicateur de chargement
    const container = document.getElementById("servicesResults");
    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Chargement...</span>
            </div>
            <h5 class="text-white">Recherche en cours...</h5>
        </div>
    `;
    
    try {
        // Construire l'URL de recherche
        let url = `${API_URL}/services/search`;
        const params = new URLSearchParams();
        
        if (currentService && currentService !== 'all') {
            params.append('type', currentService);
        }
        
        if (ville && ville.trim() !== '') {
            params.append('ville', ville);
        }
        
        if (params.toString()) {
            url = `${API_URL}/services/search?${params.toString()}`;
        }
        
        console.log('Recherche avec URL:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const services = await response.json();
        console.log('Services trouvés:', services);
        
        // Si nous avons des services, les filtrer par type d'animal si nécessaire
        let filteredServices = services;
        
        if (petType !== 'all' && services.length > 0) {
            console.log('Filtrage par type d\'animal:', petType);
            // Pour l'instant, on affiche tous les services
            // Vous pourrez implémenter ce filtre plus tard
        }
        
        // Mettre à jour les filtres actifs
        updateActiveFilters();
        
        // Afficher les résultats
        displayServices(filteredServices);
        
    } catch (error) {
        console.error('Erreur lors de la recherche:', error);
        showError('Erreur lors de la recherche: ' + error.message);
    }
}

function updateActiveFilters() {
    const activeFiltersDiv = document.getElementById('activeFilters');
    const filterTagsDiv = document.getElementById('filterTags');
    
    if (!activeFiltersDiv || !filterTagsDiv) return;
    
    const filters = [];
    
    // Ajouter le type de service
    if (currentService && currentService !== 'all') {
        filters.push({
            type: 'service',
            label: getServiceTypeLabel(currentService),
            icon: getServiceIcon(currentService)
        });
    }
    
    // Ajouter la ville
    if (currentVille && currentVille.trim() !== '') {
        filters.push({
            type: 'ville',
            label: currentVille,
            icon: 'bi-geo-alt'
        });
    }
    
    // Ajouter le type d'animal
    if (currentPetType && currentPetType !== 'all') {
        filters.push({
            type: 'animal',
            label: getPetTypeLabel(currentPetType),
            icon: 'bi-heart'
        });
    }
    
    // Mettre à jour l'affichage
    if (filters.length > 0) {
        activeFiltersDiv.classList.remove('d-none');
        
        filterTagsDiv.innerHTML = filters.map(filter => `
            <span class="badge bg-light text-dark d-flex align-items-center">
                <i class="bi ${filter.icon} me-1"></i>
                ${filter.label}
                <button type="button" class="btn-close btn-close-sm ms-1" 
                        onclick="removeFilter('${filter.type}')" 
                        aria-label="Supprimer"></button>
            </span>
        `).join('');
    } else {
        activeFiltersDiv.classList.add('d-none');
    }
}

function removeFilter(filterType) {
    switch(filterType) {
        case 'service':
            currentService = 'all';
            document.querySelectorAll('.btn-group-vertical .btn').forEach(btn => {
                btn.classList.remove('active');
            });
            // Activer le bouton "Tous les services"
            const allBtn = document.getElementById('allBtn');
            if (allBtn) allBtn.classList.add('active');
            break;
        case 'ville':
            document.getElementById('locationInput').value = '';
            currentVille = '';
            break;
        case 'animal':
            document.getElementById('petTypeSelect').value = 'all';
            currentPetType = 'all';
            break;
    }
    
    // Refaire la recherche
    searchServices();
}

function clearFilters() {
    // Réinitialiser les boutons de service
    document.querySelectorAll('.btn-group-vertical .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const allBtn = document.getElementById('allBtn');
    if (allBtn) allBtn.classList.add('active');
    
    // Réinitialiser les autres filtres
    document.getElementById('locationInput').value = '';
    document.getElementById('petTypeSelect').value = 'all';
    
    currentService = 'all';
    currentVille = '';
    currentPetType = 'all';
    
    // Recharger tous les services
    loadServices();
    
    // Cacher les filtres actifs
    const activeFiltersDiv = document.getElementById('activeFilters');
    if (activeFiltersDiv) {
        activeFiltersDiv.classList.add('d-none');
    }
}

function getServiceIcon(serviceType) {
    const icons = {
        'vet': 'bi-heart-pulse',
        'grooming': 'bi-scissors',
        'boarding': 'bi-house-heart',
        'training': 'bi-book',
        'walking': 'bi-walking',
        'other': 'bi-three-dots'
    };
    return icons[serviceType] || 'bi-three-dots';
}

function getPetTypeLabel(petType) {
    const labels = {
        'dog': 'Chien',
        'cat': 'Chat',
        'bird': 'Oiseau',
        'rabbit': 'Lapin',
        'rodent': 'Rongeur',
        'reptile': 'Reptile',
        'other': 'Autre'
    };
    return labels[petType] || petType;
}

// ===============================
// SERVICES FUNCTIONS
// ===============================
async function loadServices(type = "all", ville = "") {
    try {
        console.log('Chargement des services...');
        
        let url = `${API_URL}/services`;
        const params = new URLSearchParams();
        
        if (type && type !== 'all') {
            params.append('type', type);
        }
        
        if (ville && ville.trim() !== '') {
            params.append('ville', ville);
        }
        
        if (params.toString()) {
            url = `${API_URL}/services/search?${params.toString()}`;
        }
        
        console.log('URL appelée:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
        }
        
        const services = await response.json();
        console.log('Services reçus:', services);
        
        // Stocker tous les services pour les filtres locaux
        allServices = services;
        
        // Afficher les services
        displayServices(services);
        
    } catch (error) {
        console.error('Erreur détaillée lors du chargement des services:', error);
        showError(`Impossible de charger les services: ${error.message}`);
    }
}

function displayServices(services) {
    const container = document.getElementById("servicesResults");
    
    if (!services || services.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="bi bi-search fs-1 text-muted mb-3"></i>
                <h4 class="text-white">Aucun service trouvé</h4>
                <p class="text-white">Essayez de modifier vos critères de recherche ou ajoutez un service !</p>
                <button class="btn btn-success mt-3" onclick="openAddServiceModal()">
                    <i class="bi bi-plus-circle me-2"></i>Ajouter un service
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = services.map(service => `
        <div class="col-md-4 mb-4">
            <div class="card shadow h-100 hover-card">
                <div class="card-img-top position-relative" style="height:200px; overflow:hidden">
                    <img 
                        src="${service.image ? service.image : getDefaultImageForService(service.type)}"
                        class="w-100 h-100"
                        style="object-fit:cover"
                        alt="${service.nom}"
                        onerror="this.src='${getDefaultImageForService(service.type)}'"
                    >
                    <span class="position-absolute top-0 end-0 m-2 badge ${getServiceBadgeClass(service.type)}">
                        ${getServiceTypeLabel(service.type)}
                    </span>
                    ${service.statut && service.statut !== 'actif' ?
                        `<span class="position-absolute top-0 start-0 m-2 badge bg-warning">
                            ${service.statut === 'inactif' ? 'Inactif' : 'En attente'}
                        </span>` : ''
                    }
                </div>
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">${service.nom || 'Sans nom'}</h5>
                    <p class="text-muted mb-1">
                        <i class="bi bi-geo-alt"></i> ${service.ville || 'Non spécifié'}
                    </p>
                    <p class="mb-2"><strong>${getServiceTypeLabel(service.type)}</strong></p>
                    <p class="mb-2 small">${service.services ? service.services.substring(0, 120) : 'Pas de description'}${service.services && service.services.length > 120 ? '...' : ''}</p>
                    <div class="mt-auto">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="fw-bold text-primary">${parseFloat(service.tarifs || 0).toFixed(2)} €</span>
                            <small class="text-muted">
                                <i class="bi bi-clock"></i> ${service.horaires || 'Non spécifié'}
                            </small>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-outline-primary btn-sm flex-fill" onclick="viewService(${service.id})">
                                <i class="bi bi-eye me-1"></i>Voir
                            </button>
                            <button class="btn btn-outline-warning btn-sm" onclick="editService(${service.id})">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-sm" onclick="deleteService(${service.id})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function getDefaultImageForService(serviceType) {
    const defaultImages = {
        'vet': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
        'grooming': 'https://images.unsplash.com/photo-1560743641-3914f2c45636?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
        'boarding': 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
        'training': 'https://images.unsplash.com/photo-1591160690555-5debfba289f0?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
        'walking': 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
        'walk': 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
        'other': 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60'
    };
    return defaultImages[serviceType] || 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60';
}

function getServiceTypeLabel(type) {
    const types = {
        'vet': 'Vétérinaire',
        'grooming': 'Toilettage',
        'boarding': 'Pension',
        'training': 'Éducation',
        'walking': 'Promenade',
        'walk': 'Promenade',
        'other': 'Autre',
        'all': 'Tous les services'
    };
    return types[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function getServiceBadgeClass(type) {
    const classes = {
        'vet': 'bg-danger',
        'grooming': 'bg-info',
        'boarding': 'bg-success',
        'training': 'bg-warning',
        'walking': 'bg-secondary',
        'walk': 'bg-secondary',
        'other': 'bg-dark'
    };
    return classes[type] || 'bg-primary';
}

function showError(message) {
    const container = document.getElementById('servicesResults');
    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <i class="bi bi-exclamation-triangle fs-1 text-danger mb-3"></i>
            <h4 class="text-danger">Erreur</h4>
            <p class="text-white">${message}</p>
            <button class="btn btn-outline-primary mt-2" onclick="loadServices()">
                <i class="bi bi-arrow-clockwise me-1"></i>Réessayer
            </button>
        </div>
    `;
}

// ===============================
// LOCATION FUNCTIONS
// ===============================
function useCurrentLocation() {
    if (navigator.geolocation) {
        // Afficher un indicateur de chargement
        const locationInput = document.getElementById('locationInput');
        locationInput.value = 'Localisation en cours...';
        locationInput.disabled = true;
        
        navigator.geolocation.getCurrentPosition(
            async function (position) {
                try {
                    // Utiliser l'API de géocodage pour obtenir la ville
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
                    const data = await response.json();
                    
                    if (data.address && data.address.city) {
                        locationInput.value = data.address.city;
                        currentVille = data.address.city;
                    } else if (data.address && data.address.town) {
                        locationInput.value = data.address.town;
                        currentVille = data.address.town;
                    } else if (data.address && data.address.village) {
                        locationInput.value = data.address.village;
                        currentVille = data.address.village;
                    } else {
                        locationInput.value = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
                        currentVille = '';
                    }
                    
                    // Exécuter la recherche automatiquement
                    searchServices();
                    
                } catch (error) {
                    console.error('Erreur de géocodage:', error);
                    locationInput.value = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
                    currentVille = '';
                    searchServices(); // Rechercher quand même avec les coordonnées
                }
                
                locationInput.disabled = false;
            },
            function (error) {
                console.error('Geolocation error:', error);
                locationInput.value = '';
                locationInput.disabled = false;
                alert('Impossible d\'obtenir votre position. Veuillez entrer une ville manuellement.');
            }
        );
    } else {
        alert('La géolocalisation n\'est pas supportée par votre navigateur.');
    }
}

// ===============================
// OTHER FUNCTIONS
// ===============================
function applyAdvancedSearch() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('advancedSearch'));
    if (modal) modal.hide();
    
    // Récupérer les valeurs des filtres avancés
    const radius = document.querySelector('#advancedSearch select').value;
    const minRating = document.querySelectorAll('#advancedSearch select')[1].value;
    const openNow = document.getElementById('openNow').checked;
    const emergency = document.getElementById('emergency').checked;
    
    console.log('Filtres avancés appliqués:', { radius, minRating, openNow, emergency });
    
    // Recharger les services
    searchServices();
    
    alert('Filtres avancés appliqués !');
}

function openMap() {
    window.open('https://www.google.com/maps?q=Paris,France', '_blank');
}

// ===============================
// SERVICE CRUD OPERATIONS
// ===============================
function openAddServiceModal() {
    const form = document.getElementById("addServiceForm");
    form.reset();
    
    // Reset modal title and button
    document.querySelector('#addServiceModal .modal-title').textContent = 'Ajouter un nouveau service';
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Ajouter le service';
    submitBtn.classList.remove('btn-primary');
    submitBtn.classList.add('btn-success');
    
    // Remove edit ID if exists
    delete form.dataset.editId;
    
    // Clear image preview
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) {
        imagePreview.innerHTML = '';
    }
    
    new bootstrap.Modal(document.getElementById("addServiceModal")).show();
}

async function viewService(id) {
    try {
        const response = await fetch(`${API_URL}/services/${id}`);
        if (!response.ok) throw new Error('Service non trouvé');

        const service = await response.json();

        // Create a modal to show service details
        const modalContent = `
            <div class="modal fade" id="serviceDetailModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${service.nom}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <img src="${service.image || getDefaultImageForService(service.type)}" 
                                         class="img-fluid rounded mb-3" 
                                         alt="${service.nom}"
                                         style="max-height: 300px; object-fit: cover;">
                                </div>
                                <div class="col-md-6">
                                    <p><strong>Type:</strong> ${getServiceTypeLabel(service.type)}</p>
                                    <p><strong>Ville:</strong> ${service.ville}</p>
                                    <p><strong>Tarifs:</strong> ${service.tarifs || 0} €</p>
                                    <p><strong>Services:</strong> ${service.services || 'Non spécifié'}</p>
                                    <p><strong>Horaires:</strong> ${service.horaires || 'Non spécifié'}</p>
                                    <p><strong>Statut:</strong> <span class="badge ${service.statut === 'actif' ? 'bg-success' : 'bg-warning'}">${service.statut || 'en_attente'}</span></p>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('serviceDetailModal');
        if (existingModal) existingModal.remove();

        // Add modal to body and show it
        document.body.insertAdjacentHTML('beforeend', modalContent);
        const modal = new bootstrap.Modal(document.getElementById('serviceDetailModal'));
        modal.show();

    } catch (error) {
        console.error('Error viewing service:', error);
        alert('Erreur lors de la récupération du service');
    }
}

async function editService(id) {
    try {
        const response = await fetch(`${API_URL}/services/${id}`);
        if (!response.ok) throw new Error('Service non trouvé');

        const service = await response.json();

        // Fill the form with existing data
        const form = document.getElementById("addServiceForm");
        form.querySelector('[name="nom"]').value = service.nom || '';
        form.querySelector('[name="type"]').value = service.type || 'vet';
        form.querySelector('[name="ville"]').value = service.ville || '';
        form.querySelector('[name="tarifs"]').value = service.tarifs || '';
        form.querySelector('[name="services"]').value = service.services || '';
        form.querySelector('[name="horaires"]').value = service.horaires || '';
        form.querySelector('[name="statut"]').value = service.statut || 'en_attente';

        // Show existing image if available
        const imagePreview = document.getElementById('imagePreview');
        if (imagePreview) {
            if (service.image) {
                imagePreview.innerHTML = `
                    <div class="alert alert-info p-2 mt-2">
                        <small class="d-block mb-2">Image actuelle :</small>
                        <img src="${service.image}" 
                             class="img-thumbnail" 
                             style="max-width: 200px; max-height: 150px;"
                             alt="Image actuelle">
                        <div class="mt-2">
                            <small>Image existante (sera gardée si pas de nouvelle image)</small>
                        </div>
                    </div>
                `;
            } else {
                imagePreview.innerHTML = '';
            }
        }

        // Change modal title and button
        document.querySelector('#addServiceModal .modal-title').textContent = 'Modifier le service';
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Mettre à jour';
        submitBtn.classList.remove('btn-success');
        submitBtn.classList.add('btn-primary');

        // Store the ID for update
        form.dataset.editId = id;

        // Open the modal
        const modal = new bootstrap.Modal(document.getElementById('addServiceModal'));
        modal.show();

    } catch (error) {
        console.error('Error editing service:', error);
        alert('Erreur lors de la modification');
    }
}

async function deleteService(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce service ?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/services/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Échec de la suppression');

        const result = await response.json();

        if (result.success) {
            alert('Service supprimé avec succès !');
            searchServices(); // Recharger les services
        } else {
            alert('Erreur: ' + (result.error || 'Erreur inconnue'));
        }
    } catch (error) {
        console.error('Error deleting service:', error);
        alert('Erreur lors de la suppression');
    }
}

// ===============================
// FORM HANDLING
// ===============================
document.getElementById("addServiceForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const isEdit = this.dataset.editId;
    const url = isEdit ? `${API_URL}/services/${this.dataset.editId}` : `${API_URL}/services`;
    const method = isEdit ? "PUT" : "POST";

    const formData = new FormData(this);

    try {
        const res = await fetch(url, {
            method: method,
            body: formData
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Erreur serveur: ${res.status} - ${errorText}`);
        }

        const data = await res.json();

        if (data.success) {
            alert(isEdit ? 'Service modifié avec succès !' : 'Service ajouté avec succès !');

            // Reset form and modal
            this.reset();
            delete this.dataset.editId;

            const modal = bootstrap.Modal.getInstance(document.getElementById("addServiceModal"));
            if (modal) modal.hide();

            // Reset modal title and button
            document.querySelector('#addServiceModal .modal-title').textContent = 'Ajouter un nouveau service';
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Ajouter le service';
            submitBtn.classList.remove('btn-primary');
            submitBtn.classList.add('btn-success');

            // Clear image preview
            const imagePreview = document.getElementById('imagePreview');
            if (imagePreview) {
                imagePreview.innerHTML = '';
            }

            // Reload services
            searchServices();
        } else {
            alert("Erreur: " + (data.error || "Erreur inconnue"));
        }
    } catch (error) {
        console.error('Form submission error:', error);
        alert("Erreur lors de l'opération: " + error.message);
    }
});

// Image preview functionality
document.querySelector('input[name="image"]')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('L\'image est trop volumineuse (max 5MB)');
        this.value = '';
        return;
    }

    // Check file type
    if (!file.type.match('image.*')) {
        alert('Veuillez sélectionner une image');
        this.value = '';
        return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = function(e) {
        let previewContainer = document.getElementById('imagePreview');
        if (!previewContainer) {
            previewContainer = document.createElement('div');
            previewContainer.id = 'imagePreview';
            previewContainer.className = 'mt-3';
            document.querySelector('input[name="image"]').parentNode.appendChild(previewContainer);
        }
        
        previewContainer.innerHTML = `
            <div class="alert alert-info p-2">
                <small class="d-block mb-2">Aperçu de l'image :</small>
                <img src="${e.target.result}" 
                     class="img-thumbnail" 
                     style="max-width: 200px; max-height: 150px;"
                     alt="Aperçu">
                <div class="mt-2">
                    <small>${file.name} (${Math.round(file.size / 1024)} KB)</small>
                </div>
            </div>
        `;
    };
    reader.readAsDataURL(file);
});

document.getElementById("contactForm").addEventListener("submit", function (e) {
    e.preventDefault();

    const formData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        petType: document.getElementById('contactPetType').value,
        service: document.getElementById('service').value,
        message: document.getElementById('message').value
    };

    console.log('Contact form submitted:', formData);
    alert('Merci ! Votre message a été envoyé. Nous vous répondrons dans les plus brefs délais.');
    this.reset();
});

// ===============================
// EVENT LISTENERS & INITIALIZATION
// ===============================
document.addEventListener('DOMContentLoaded', function () {
    console.log('Page chargée, initialisation...');
    
    // Load initial services
    loadServices();
    
    // Set default active button
    const defaultBtn = document.querySelector('.btn-group-vertical .btn.active');
    if (!defaultBtn) {
        const vetBtn = document.getElementById('vetBtn');
        if (vetBtn) vetBtn.classList.add('active');
    }

    // Search on Enter key
    const locationInput = document.getElementById('locationInput');
    if (locationInput) {
        locationInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                searchServices();
            }
        });
    }

    // Auto-search when pet type changes
    const petTypeSelect = document.getElementById('petTypeSelect');
    if (petTypeSelect) {
        petTypeSelect.addEventListener('change', function() {
            currentPetType = this.value;
            searchServices();
        });
    }

    // Reset form when modal closes
    const addServiceModal = document.getElementById('addServiceModal');
    if (addServiceModal) {
        addServiceModal.addEventListener('hidden.bs.modal', function () {
            const form = document.getElementById('addServiceForm');
            if (form) {
                form.reset();
                delete form.dataset.editId;
                document.querySelector('#addServiceModal .modal-title').textContent = 'Ajouter un nouveau service';
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.textContent = 'Ajouter le service';
                    submitBtn.classList.remove('btn-primary');
                    submitBtn.classList.add('btn-success');
                }
                
                // Clear image preview
                const imagePreview = document.getElementById('imagePreview');
                if (imagePreview) {
                    imagePreview.innerHTML = '';
                }
            }
        });
    }

    // Initialize active nav link
    updateActiveNavLink();
    
    console.log('Initialisation terminée');
});

// ===============================
// NAVBAR FUNCTIONS
// ===============================
function scrollToServices() {
    const servicesSection = document.getElementById('services');
    if (servicesSection) {
        servicesSection.scrollIntoView({
            behavior: 'smooth'
        });
    }
}

function updateActiveNavLink() {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-link');
    let current = '';

    sections.forEach(section => {
        const sectionTop = section.offsetTop - 100;
        const sectionHeight = section.clientHeight;
        if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
}

window.addEventListener('scroll', function () {
    const navbar = document.querySelector('.navbar-custom');
    if (navbar) {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    updateActiveNavLink();
});