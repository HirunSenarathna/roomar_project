(() => {
  const products = {
    sofa: { name: 'Modern Sofa', asset: '#sofaModel', scale: '0.42 0.42 0.42', position: '0 0 0' },
    chair: { name: 'Lounge Chair', asset: '#chairModel', scale: '0.55 0.55 0.55', position: '0 0 0' },
    table: { name: 'Coffee Table', asset: '#tableModel', scale: '0.55 0.55 0.55', position: '0 0 0' },
    plant: { name: 'Indoor Plant', asset: '#plantModel', scale: '0.52 0.52 0.52', position: '0 0 0' },
    curtain: { name: 'Curtain Set', asset: '#curtainModel', scale: '0.40 0.40 0.40', position: '0 0.48 0' }
  };

  const marker = document.querySelector('#hiroMarker');
  const model = document.querySelector('#markerModel');
  const title = document.querySelector('#markerStatusTitle');
  const text = document.querySelector('#markerStatusText');
  const dot = document.querySelector('#markerDot');
  const productName = document.querySelector('#markerProductName');
  const buttons = [...document.querySelectorAll('[data-product]')];

  function selectProduct(id) {
    const p = products[id];
    if (!p) return;
    model.setAttribute('visible', false);
    model.setAttribute('gltf-model', p.asset);
    model.setAttribute('scale', p.scale);
    model.setAttribute('position', p.position);
    productName.textContent = p.name;
    buttons.forEach(button => button.classList.toggle('active', button.dataset.product === id));
  }

  model.addEventListener('model-loaded', () => {
    model.setAttribute('visible', true);
  });

  marker.addEventListener('markerFound', () => {
    title.textContent = 'Marker detected';
    text.textContent = 'The selected 3D product is anchored to the marker.';
    dot.classList.add('good');
  });

  marker.addEventListener('markerLost', () => {
    title.textContent = 'Searching for marker';
    text.textContent = 'Keep the full Hiro marker visible and well lit.';
    dot.classList.remove('good');
  });

  buttons.forEach(button => button.addEventListener('click', () => selectProduct(button.dataset.product)));
  selectProduct('sofa');
})();
