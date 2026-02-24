document.addEventListener('DOMContentLoaded', () => {
    function escapeHTML(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    const productId = window.location.pathname.split('/').pop();

    fetch('/products')
        .then(response => {
            if (!response.ok) throw new Error('Network error: ' + response.statusText);
            return response.json();
        })
        .then(products => {
            const product = products.find(p => p.id === productId);

            if (product) {
                const formattedOptions = escapeHTML(product.options).replace(/\./g, '<br>');

                let galleryHTML = '';
                if (product.display_image && product.display_image.length > 0) {
                    galleryHTML = product.display_image.map(img =>
                        `<a href="${escapeHTML(img)}" data-lightbox="product-gallery" data-title="${escapeHTML(product.modele)}"><img class="product-thumb" src="${escapeHTML(img)}" alt="${escapeHTML(product.modele)}" loading="lazy"></a>`
                    ).join('');
                }

                let output = `
                <div class="product-card">
                    <div class="product-hero" style="color: rgb(255, 191, 0);">
                        <h1 class="product" style="color:rgb(255, 191, 0);">${escapeHTML(product.modele)} - ${escapeHTML(product.price)}&euro;</h1>
                        <img class="product-main-image" src="${escapeHTML(product.pimage)}" alt="${escapeHTML(product.modele)}" loading="lazy">
                    </div>
                    <p class="highlight-text">Ne manquez pas cette occasion de posséder une voiture de qualité supérieure ! Faites confiance à MARIN MOTOR pour trouver le véhicule de vos rêves.</p>
                    <div class="product-details container-fluid px-0">
                        <div class="row g-0">
                            <div class="col-lg-6 product-specs">
                                <h2 class="section-title">Caractéristiques</h2>
                                <p><span class="label">Marque:</span> ${escapeHTML(product.marque)}</p>
                                <p><span class="label">Modèle:</span> ${escapeHTML(product.modele)}</p>
                                <p><span class="label">Année:</span> ${escapeHTML(product.Annee)}</p>
                                <p><span class="label">Kilométrage:</span> ${escapeHTML(product.Kilometrage)}</p>
                                <p><span class="label">Carburant:</span> ${escapeHTML(product.Carburant)}</p>
                                <p><span class="label">Puissance:</span> ${escapeHTML(product.puissance)}</p>
                                <p><span class="label">Moteur:</span> ${escapeHTML(product.moteur)}</p>
                                <p><span class="label">Boîte:</span> ${escapeHTML(product.boite)}</p>
                            </div>
                            <div class="col-lg-6 product-options">
                                <h2 class="section-title">Options Incluses</h2>
                                <p>${formattedOptions}</p>
                            </div>
                        </div>
                    </div>
                    <div class="product-gallery">
                        <h2>Photos</h2>
                        <div class="product-images">
                            ${galleryHTML}
                        </div>
                    </div>
                    <p class="contact-info">Pour plus d'informations ou pour planifier un essai routier, contactez-nous au 080.550.080 ou envoyez-nous un email à l'adresse <a href="mailto:marin.motor17@gmail.com">marin.motor17@gmail.com</a>.</p>
                </div>
                `;
                document.querySelector(".car-details").innerHTML = output;
            } else {
                document.querySelector(".car-details").textContent = 'Product not found';
            }
        })
        .catch(error => console.error('Error fetching product:', error));
});
