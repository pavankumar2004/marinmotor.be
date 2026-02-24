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

        fetch('/products')
            .then(response => {
                if (!response.ok) throw new Error('Network error: ' + response.statusText);
                return response.json();
            })
            .then(products => {
                let output = "";
                for (let item of products) {
                    output += `
                        <div class="product">
                            <img style="border-radius: 15px;" src="${escapeHTML(item.pimage)}" alt="${escapeHTML(item.description)}" loading="lazy">
                            <p style="margin-top:10px"><span class="text-primary">${escapeHTML(item.marque)} ${escapeHTML(item.modele)}</span></p>
                            <p>${escapeHTML(item.Annee)} ${escapeHTML(item.puissance)} ${escapeHTML(item.Carburant)} ${escapeHTML(item.Kilometrage)}</p>
                            <p><span class="text-primary" style="margin-right:20px">${escapeHTML(item.price)}&euro;</span></p>
                            <a href="/listing/${encodeURIComponent(item.id)}" style="border-radius:15px;" class="btn btn-dark">Details</a>
                        </div>
                    `;
                }
                document.querySelector(".products").innerHTML = output;
            })
            .catch(error => console.error('Error fetching products:', error));
    });
