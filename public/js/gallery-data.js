// Job photos per service (services page galleries).
// To add a photo: drop the file in public/images/<folder>/ and add its path to the list.
(function () {
  const list = (folder, names) => names.map((n) => `/images/${folder}/${n}.jpg`);
  window.GALLERY = {
    'spray-foam': {
      label: 'Spray foam',
      photos: list('sprayfoam', ['sprayfoam-14', 'sprayfoam-3', 'sprayfoam-13', 'sprayfoam-2', 'sprayfoam-15', 'sprayfoam-0',
        'sprayfoam-10', 'sprayfoam-9', 'sprayfoam-1', 'sprayfoam-8', 'sprayfoam-4', 'sprayfoam-5', 'sprayfoam-6', 'sprayfoam-11']),
    },
    'cellulose': {
      label: 'Dense-pack cellulose',
      photos: list('cellulose', ['cellulose-3', 'cellulose-0', 'cellulose-1', 'cellulose-2']),
    },
    'fiberglass': {
      label: 'Fiberglass',
      photos: list('fiberglass', ['fiberglass-commercial', 'fiberglass-1', 'fiberglass-0', 'fiberglass-2', 'fiberglass-4', 'fiberglass-5', 'fiberglass-7', 'fiberglass-8']),
    },
    'air-sealing': {
      label: 'Air sealing',
      photos: list('airsealing', ['airsealing-2', 'airsealing-4', 'airsealing-0', 'airsealing-5', 'airsealing-1']),
    },
    'ventilation': {
      label: 'Ventilation',
      photos: list('ventilation', ['ventilation-0', 'ventilation-5', 'ventilation-1', 'ventilation-2', 'ventilation-3']),
    },
    'vapor-barrier': {
      label: 'Vapor barrier',
      // Poly vapor barrier is visible in these fiberglass jobs; swap in dedicated shots when available.
      photos: list('fiberglass', ['fiberglass-3', 'fiberglass-6']),
    },
  };
})();
