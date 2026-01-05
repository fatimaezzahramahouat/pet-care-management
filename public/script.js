// ===============================
// GLOBAL VARIABLES
// ===============================
let currentService = 'vet';
let currentVille = '';
let currentPetType = 'all';
let allServices = []; // Pour stocker tous les services
const API_URL = 'http://localhost:5000/api';

// ===============================
// FAVORITES FUNCTIONS
// ===============================

// Récupérer l'ID utilisateur (à adapter selon votre système d'authentification)
// Récupérer l'ID utilisateur
function getCurrentUserId() {
    const user = JSON.parse(localStorage.getItem('user'));
    return user ? user.id : null;
}

// Ajouter aux favoris
async function addToFavorites(userId, serviceId) {
    const response = await fetchWithAuth(`${API_URL}/favorites`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id: userId,
            service_id: serviceId
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'ajout aux favoris');
    }
    
    return await response.json();
}

// Retirer des favoris
async function removeFromFavorites(userId, serviceId) {
    const response = await fetchWithAuth(`${API_URL}/favorites`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id: userId,
            service_id: serviceId
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la suppression des favoris');
    }
    
    return await response.json();
}

// Gérer l'action de favoris avec confirmation
async function handleFavoriteAction(serviceId, action) {
    const userId = getCurrentUserId();
    
    if (!userId) {
        alert('Veuillez vous connecter pour gérer vos favoris');
        return;
    }
    
    try {
        if (action === 'add') {
            await addToFavorites(userId, serviceId);
            updateFavoriteUI(serviceId, true);
        } else {
            await removeFromFavorites(userId, serviceId);
            updateFavoriteUI(serviceId, false);
        }
    } catch (error) {
        console.error('Erreur lors de la modification des favoris:', error);
        alert('Erreur lors de la modification des favoris');
    }
}

// Mettre à jour l'interface utilisateur pour les favoris
function updateFavoriteUI(serviceId, isFavorite) {
    // Mettre à jour le bouton favori
    const favoriteBtn = document.querySelector(`[data-service-id="${serviceId}"]`);
    if (favoriteBtn) {
        favoriteBtn.classList.toggle('btn-danger', isFavorite);
        favoriteBtn.classList.toggle('btn-outline-danger', !isFavorite);
        favoriteBtn.querySelector('i').className = isFavorite ? 'bi bi-heart-fill' : 'bi bi-heart';
        favoriteBtn.title = isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris';
        favoriteBtn.onclick = () => handleFavoriteAction(serviceId, isFavorite ? 'remove' : 'add');
    }
    
    // Mettre à jour l'état dans le tableau allServices
    const serviceIndex = allServices.findIndex(s => s.id == serviceId);
    if (serviceIndex !== -1) {
        allServices[serviceIndex].is_favorite = isFavorite;
    }
}

// Consulter mes favoris
async function viewMyFavorites() {
    const userId = getCurrentUserId();
    
    if (!userId) {
        alert('Veuillez vous connecter pour voir vos favoris');
        return;
    }
    
    try {
        // Afficher un indicateur de chargement
        const container = document.getElementById("servicesResults");
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">Chargement...</span>
                </div>
                <h5 class="text-white">Chargement de vos favoris...</h5>
            </div>
        `;
        
        // Récupérer les favoris
        const response = await fetchWithAuth(`${API_URL}/favorites/${userId}`);
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Erreur inconnue');
        }
        
        // Transformer les données pour l'affichage
        const favoriteServices = data.favorites.map(fav => ({
            ...fav.services_animaliers,
            is_favorite: true // Marquer comme favori
        }));
        
        // Afficher les services favoris
        displayServices(favoriteServices);
        
        // Mettre à jour le titre
        const title = document.getElementById('servicesTitle');
        if (title) {
            title.textContent = 'Mes Services Favoris';
        }
        
        // Afficher un bouton pour revenir à tous les services
        const existingBackBtn = document.querySelector('.back-to-all-btn');
        if (existingBackBtn) existingBackBtn.remove();
        
        container.insertAdjacentHTML('beforebegin', `
            <div class="row mb-4 back-to-all-btn">
                <div class="col-12">
                    <button class="btn btn-outline-secondary" onclick="loadServicesWithFavorites()">
                        <i class="bi bi-arrow-left me-2"></i>Retour à tous les services
                    </button>
                </div>
            </div>
        `);
        
    } catch (error) {
        console.error('Erreur lors du chargement des favoris:', error);
        showError('Erreur lors du chargement des favoris: ' + error.message);
    }
}

// Fonction pour charger les services avec l'état des favoris
async function loadServicesWithFavorites(type = "all", ville = "") {
    try {
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
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
        }
        
        const services = await response.json();
        
        // Si un utilisateur est connecté, récupérer ses favoris
        const userId = getCurrentUserId();
        if (userId) {
            try {
                const favResponse = await fetch(`${API_URL}/favorites/${userId}`);
                if (favResponse.ok) {
                    const favData = await favResponse.json();
                    if (favData.success && favData.favorites) {
                        // Créer un Set des IDs de services favoris
                        const favoriteIds = new Set(
                            favData.favorites.map(fav => fav.service_id)
                        );
                        
                        // Marquer les services comme favoris
                        services.forEach(service => {
                            service.is_favorite = favoriteIds.has(service.id);
                        });
                    }
                }
            } catch (favError) {
                console.error('Erreur lors du chargement des favoris:', favError);
                // Continuer sans les informations de favoris
            }
        }
        
        // Stocker et afficher les services
        allServices = services;
        displayServices(services);
        
        // Réinitialiser le titre
        const title = document.getElementById('servicesTitle');
        if (title) {
            title.textContent = 'Nos Services';
        }
        
        // Supprimer le bouton retour s'il existe
        const backBtn = document.querySelector('.back-to-all-btn');
        if (backBtn) backBtn.remove();
        
    } catch (error) {
        console.error('Erreur détaillée lors du chargement des services:', error);
        showError(`Impossible de charger les services: ${error.message}`);
    }
}

// ===============================
// DISPLAY SERVICES FUNCTION
// ===============================
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
                    <!-- BOUTON FAVORI -->
                    <button class="position-absolute bottom-0 end-0 m-2 btn btn-sm ${service.is_favorite ? 'btn-danger' : 'btn-outline-danger'}"
                            data-service-id="${service.id}"
                            onclick="handleFavoriteAction(${service.id}, '${service.is_favorite ? 'remove' : 'add'}')"
                            title="${service.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
                        <i class="bi ${service.is_favorite ? 'bi-heart-fill' : 'bi-heart'}"></i>
                    </button>
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
    
    // Appliquer la pagination après l'affichage
    if (container.children.length > 0) {
        currentPage = 1;
        paginateServices();
    }
}

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
        await loadServicesWithFavorites(currentService, ville);
        updateActiveFilters();
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
    loadServicesWithFavorites();
    
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
        'walk': 'bi-walking',
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
    // Utiliser la nouvelle fonction avec favoris
    await loadServicesWithFavorites(type, ville);
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
            <button class="btn btn-outline-primary mt-2" onclick="loadServicesWithFavorites()">
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

// ===============================
// SCRAPING FUNCTIONS
// ===============================
function showScrapingTab() {
    const scrapingTab = document.getElementById('scraping-tab');
    if (scrapingTab) {
        const tab = new bootstrap.Tab(scrapingTab);
        tab.show();
        // Scroll to top of tab content
        window.scrollTo({ top: scrapingTab.offsetTop - 100, behavior: 'smooth' });
    }
}

function initScrapingForm() {
    const scrapingForm = document.getElementById('scrapingForm');
    if (!scrapingForm) return;

    const maxLeadsInput = document.getElementById('maxLeads');
    const rangeValue = document.getElementById('rangeValue');
    const scrapeBtn = document.getElementById('scrapeBtn');
    const resetBtn = document.getElementById('resetBtn');
    const resultSection = document.getElementById('resultSection');
    const progressBar = document.getElementById('progressBar');
    const statusMessage = document.getElementById('statusMessage');
    const statusTitle = document.getElementById('statusTitle');
    const jobIdSpan = document.getElementById('jobId');
    const locationStatus = document.getElementById('location_status');
    const openSheetBtn = document.getElementById('openSheetBtn');

    // Pre-fill user info
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.name) document.getElementById('nom').value = user.name;
    if (user.email) document.getElementById('email_scrape').value = user.email;

    // Update range value display
    if (maxLeadsInput && rangeValue) {
        maxLeadsInput.addEventListener('input', (e) => {
            rangeValue.textContent = e.target.value;
        });
    }

    // Reset form
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            scrapingForm.reset();
            if (rangeValue) rangeValue.textContent = '20';
            if (resultSection) resultSection.classList.add('d-none');
        });
    }

    // Handle form submission
    scrapingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            nom: document.getElementById('nom').value,
            email: document.getElementById('email_scrape').value,
            telephone: document.getElementById('telephone').value,
            ville: document.getElementById('ville_scrape').value,
            country: document.getElementById('country').value,
            maxLeads: document.getElementById('maxLeads').value
        };

        // Show result section and loading state
        resultSection.classList.remove('d-none');
        scrapeBtn.disabled = true;
        scrapeBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Envoi...`;
        
        statusTitle.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i> Initialisation...`;
        statusMessage.textContent = 'Connexion au serveur de scraping...';
        progressBar.style.width = '10%';
        locationStatus.textContent = formData.ville;

        try {
            const response = await fetchWithAuth(`${API_URL}/scrape`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erreur lors du lancement du scraping');
            }

            const result = await response.json();
            
            // Success state
            progressBar.style.width = '100%';
            progressBar.classList.remove('progress-bar-animated');
            statusTitle.innerHTML = `<i class="fas fa-check-circle text-success me-2"></i> Scraping Lancé !`;
            statusMessage.textContent = 'La demande a été envoyée avec succès à n8n. Vos résultats seront bientôt disponibles dans Google Sheet.';
            
            if (result.data && result.data.jobId) {
                jobIdSpan.textContent = result.data.jobId;
            } else {
                jobIdSpan.textContent = 'N/A';
            }

            // If n8n returns a sheet URL, open it automatically
            if (result.data && result.data.sheetUrl) {
                openSheetBtn.classList.remove('d-none');
                openSheetBtn.onclick = () => window.open(result.data.sheetUrl, '_blank');
                
                // Automatic redirect after a short delay to let user see the success message
                statusMessage.textContent = 'Scraping terminé ! Redirection vers vos résultats...';
                setTimeout(() => {
                    window.open(result.data.sheetUrl, '_blank');
                }, 2000);
            }

            alert('Demande de scraping envoyée avec succès !');

        } catch (error) {
            console.error('Scraping error:', error);
            statusTitle.innerHTML = `<i class="fas fa-exclamation-triangle text-danger me-2"></i> Erreur`;
            statusMessage.textContent = error.message;
            progressBar.classList.add('bg-danger');
            alert('Erreur: ' + error.message);
        } finally {
            scrapeBtn.disabled = false;
            scrapeBtn.innerHTML = `<i class="fas fa-bolt me-2"></i> Lancer le Scraping`;
        }
    });
}

// ---------------------------------------------------------
// EDIT SERVICE MODAL LOGIC (CONTINUED)
// ---------------------------------------------------------
async function openEditServiceModal(id) {
    if (!localStorage.getItem('token')) {
        alert('Veuillez vous connecter pour gérer vos services');
        return;
    }
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

function openAddServiceModal() {
    if (!localStorage.getItem('token')) {
        alert('Veuillez vous connecter pour ajouter un service');
        return;
    }
    
    // Reset form for new entry
    const form = document.getElementById("addServiceForm");
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
        if (imagePreview) imagePreview.innerHTML = '';
    }

    const modal = new bootstrap.Modal(document.getElementById('addServiceModal'));
    modal.show();
}

async function deleteService(id) {
    if (!localStorage.getItem('token')) {
        alert('Veuillez vous connecter pour supprimer un service');
        return;
    }
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce service ?')) {
        return;
    }

    try {
        const response = await fetchWithAuth(`${API_URL}/services/${id}`, {
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

    const submitBtn = this.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Envoi en cours...`;

    const formData = new FormData(this);

    try {
        const res = await fetchWithAuth(url, {
            method: method,
            body: formData
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Erreur serveur: ${res.status} - ${errorText}`);
        }

        const data = await res.json();

        if (data.success) {
            alert(isEdit ? 'Service mis à jour avec succès !' : 'Service ajouté avec succès !');
            
            // Close modal
            const modalElement = document.getElementById('addServiceModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();

            // Reset form
            this.reset();
            delete this.dataset.editId;
            
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
            searchServices(); // Reload services
        } else {
            alert('Erreur: ' + (data.error || 'Erreur inconnue'));
        }
    } catch (error) {
        console.error('Error submitting form:', error);
        alert('Erreur lors de l\'envoi du formulaire: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
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

const contactForms = ['contactForm', 'contactFormDashboard'];
contactForms.forEach(formId => {
    const contactForm = document.getElementById(formId);
    if (contactForm) {
        contactForm.addEventListener("submit", function (e) {
            e.preventDefault();

            const formData = {
                firstName: contactForm.querySelector('#firstName')?.value,
                lastName: contactForm.querySelector('#lastName')?.value,
                email: contactForm.querySelector('#email_contact')?.value || contactForm.querySelector('#email')?.value,
                phone: contactForm.querySelector('#phone')?.value,
                petType: contactForm.querySelector('#contactPetType')?.value,
                service: contactForm.querySelector('#service_contact')?.value || contactForm.querySelector('#service')?.value,
                message: contactForm.querySelector('#message')?.value
            };

            console.log('Contact form submitted:', formData);
            alert('Merci ! Votre message a été envoyé. Nous vous répondrons dans les plus brefs délais.');
            this.reset();
        });
    }
});
//auth


// ============================
// DYNAMIC NAVBAR
// ============================
function updateNavbar() {
    const authButtons = document.getElementById('authButtons');
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!authButtons) return;

    if (token && user) {
        authButtons.innerHTML = `
            <div class="dropdown">
                <button class="btn btn-outline-primary dropdown-toggle" type="button" id="userDropdown" data-bs-toggle="dropdown">
                    <i class="bi bi-person-circle me-1"></i> ${user.name}
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow border-0 rounded-3">
                    <li><a class="dropdown-item py-2" href="dashboard.html"><i class="bi bi-speedometer2 me-2"></i> Tableau de bord</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item py-2 text-danger" href="javascript:void(0)" onclick="logout()"><i class="bi bi-box-arrow-right me-2"></i> Déconnexion</a></li>
                </ul>
            </div>
        `;
    }
}

// ============================
// REGISTER
// ============================
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = registerForm.name.value.trim();
        const email = registerForm.email.value.trim();
        const password = registerForm.password.value;

        try {
            const res = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();

            if (!data.success) return alert('Erreur: ' + data.error);

            alert(data.message || 'Compte créé avec succès ! Veuillez vous connecter.');
            registerForm.reset();
            
            // Auto close register and open login
            const regModalEl = document.getElementById('registerModal');
            const logModalEl = document.getElementById('loginModal');
            if (regModalEl && logModalEl) {
                const regModal = bootstrap.Modal.getInstance(regModalEl) || new bootstrap.Modal(regModalEl);
                regModal.hide();
                const logModal = bootstrap.Modal.getInstance(logModalEl) || new bootstrap.Modal(logModalEl);
                logModal.show();
            }

        } catch (err) {
            console.error(err);
            alert('Erreur lors de l\'inscription');
        }
    });
}

// ============================
// LOGIN
// ============================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm.email.value.trim();
        const password = loginForm.password.value;

        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (!data.success) return alert('Erreur: ' + (data.error || data.message));

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            alert('Connexion réussie !');
            window.location.href = 'dashboard.html';
        } catch (err) {
            console.error(err);
            alert('Erreur lors de la connexion');
        }
    });
}

// ============================
// AUTH HELPERS
// ============================
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        if (window.location.pathname.includes('dashboard.html')) {
            window.location.href = 'index.html';
        }
        return false;
    }
    return true;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
    }
    
    const response = await fetch(url, options);
    if (response.status === 401 || response.status === 403) {
        logout();
    }
    return response;
}

// ===============================
// PAGINATION
// ===============================
let currentPage = 1;
const itemsPerPage = 6;

function paginateServices() {
  const container = document.getElementById("servicesResults");
  if (!container) return;

  const cards = Array.from(container.children)
    .filter(el => el.className.includes("col-"));

  const totalPages = Math.ceil(cards.length / itemsPerPage);

  cards.forEach((card, index) => {
    card.style.display =
      index >= (currentPage - 1) * itemsPerPage &&
      index < currentPage * itemsPerPage
        ? "block"
        : "none";
  });

  document.getElementById("pageIndicator").innerText =
    `Page ${currentPage} / ${totalPages}`;

  document.getElementById("prevPage").disabled = currentPage === 1;
  document.getElementById("nextPage").disabled = currentPage === totalPages || totalPages === 0;
}

document.getElementById("nextPage").addEventListener("click", () => {
  currentPage++;
  paginateServices();
});

document.getElementById("prevPage").addEventListener("click", () => {
  currentPage--;
  paginateServices();
});

const container = document.getElementById("servicesResults");
const observer = new MutationObserver(() => {
  if (container.children.length > 0) {
    currentPage = 1;
    paginateServices();
    observer.disconnect();
  }
});

observer.observe(container, { childList: true });

// ===============================
// EVENT LISTENERS & INITIALIZATION
// ===============================
document.addEventListener('DOMContentLoaded', function () {
    console.log('Page chargée, initialisation...');
    
    // Load initial services with favorites
    loadServicesWithFavorites();

    // Initialize scraping form
    initScrapingForm();
    
    // Set default active button
    const defaultBtn = document.querySelector('.btn-group-vertical .btn.active');
    if (!defaultBtn) {
        const vetBtn = document.getElementById('vetBtn');
        if (vetBtn) vetBtn.classList.add('active');
    }

    // Search on Enter key
    const locationInput = document.getElementById('locationInput') || document.getElementById('locationInputDashboard');
    if (locationInput) {
        locationInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                searchServices(true);
            }
        });
    }

    // Auto-search when pet type changes
    const petTypeSelect = document.getElementById('petTypeSelect') || document.getElementById('petTypeSelectDashboard');
    if (petTypeSelect) {
        petTypeSelect.addEventListener('change', function() {
            currentPetType = this.value;
            searchServices(true);
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
    
    // Update navbar for auth state
    updateNavbar();
    
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

// ===============================
// SCROLL EVENT
// ===============================
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