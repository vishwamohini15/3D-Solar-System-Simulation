        // Global variables for Three.js scene elements
        let scene, camera, renderer, sun, controls;
        let planets = []; // Array to store planet objects and their properties
        let clock = new THREE.Clock(); // For consistent animation across different frame rates
        let isPaused = false; // Flag for pause/resume functionality

        // Raycaster for hover interactions
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let intersectedPlanet = null;
        const tooltip = document.getElementById('tooltip');

        // Three.js Texture Loader
        const textureLoader = new THREE.TextureLoader();

        // Planet data (simplified for visual representation)
        // orbitalPeriod is in Earth days (approx), axialRotation is rotation speed on its axis
        const planetData = [
            // Significantly increased radius and distanceFromSun for larger, more visible planets
            // and adjusted orbital speeds for a balanced visual effect
            // Updated texture paths to provided asset locations
            { name: 'Mercury', radius: 30, distanceFromSun: 400, texture: 'assets/mercury.jpg', color: 0xcccccc, orbitalPeriod: 88, axialRotation: 0.05 },
            { name: 'Venus', radius: 45, distanceFromSun: 550, texture: 'assets/venus.jpg', color: 0xe6e6a1, orbitalPeriod: 225, axialRotation: 0.03 },
            { name: 'Earth', radius: 54, distanceFromSun: 700, texture: 'assets/earth.jpg', color: 0x4d88ff, orbitalPeriod: 365, axialRotation: 0.1 },
            { name: 'Mars', radius: 36, distanceFromSun: 850, texture: 'assets/mars.jpg', color: 0xff6600, orbitalPeriod: 687, axialRotation: 0.09 },
            { name: 'Jupiter', radius: 135, distanceFromSun: 1300, texture: 'assets/jupiter.jpg', color: 0xd9b38c, orbitalPeriod: 4331, axialRotation: 0.2 },
            { name: 'Saturn', radius: 114, distanceFromSun: 1750, texture: 'assets/saturn.jpg', color: 0xffc34d, orbitalPeriod: 10747, axialRotation: 0.18 },
            { name: 'Uranus', radius: 81, distanceFromSun: 2200, texture: 'assets/uranus.jpg', color: 0x80bfff, orbitalPeriod: 30589, axialRotation: 0.15 },
            { name: 'Neptune', radius: 72, distanceFromSun: 2650, texture: 'assets/neptune.jpg', color: 0x3366ff, orbitalPeriod: 59800, axialRotation: 0.12 }
        ];

        /**
         * Initializes the Three.js scene, camera, renderer, and objects.
         */
        function init() {
            // Scene
            scene = new THREE.Scene();
            // Set ga dark background for the space effect
            scene.background = new THREE.Color(0x0a0a1a);

            // Camera (PerspectiveCamera: FOV, Aspect Ratio, Near, Far)
            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000); // Increased far clipping plane significantly
            // Adjusted camera position to accommodate much larger planets and distances, with a slightly more top-down view
            camera.position.set(0, 1500, 3000); // Further back and up to view the massive scaled system

            // Renderer
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            // Append the renderer's DOM element to the canvas container
            document.getElementById('canvas-container').appendChild(renderer.domElement);

            // Check if OrbitControls is available before initializing
            if (typeof THREE.OrbitControls === 'undefined') {
                console.error("THREE.OrbitControls is not defined. Make sure OrbitControls.js is loaded correctly.");
            } else {
                // OrbitControls for camera interaction
                controls = new THREE.OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true; // Smooth camera movement
                controls.dampingFactor = 0.05;
                controls.screenSpacePanning = false; // Limit panning to camera plane
                controls.minDistance = 100; // Minimum zoom in distance (adjusted for larger scale)
                controls.maxDistance = 4000; // Adjusted max zoom out distance significantly for larger system
                controls.target.set(0, 0, 0); // Ensure camera always looks at the center (Sun)
            }

            // Sun (a light source and a visual sphere)
            const sunGeometry = new THREE.SphereGeometry(140, 32, 32);
            // Load Sun texture, with a fallback to basic yellow if loading fails
            textureLoader.load('assets/sun.jpg',
                function (texture) {
                    sun.material = new THREE.MeshBasicMaterial({ map: texture });
                    sun.material.needsUpdate = true; // Tell Three.js to update material
                },
                undefined, // onProgress callback
                function (err) {
                    console.error('An error happened loading the sun texture:', err);
                    sun.material = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Fallback color
                }
            );
            // Initialize sun with a placeholder material, will be updated by textureLoader.load callback
            sun = new THREE.Mesh(sunGeometry, new THREE.MeshBasicMaterial({ color: 0xffff00 }));
            scene.add(sun);


            // PointLight at the Sun's position to illuminate planets
            const pointLight = new THREE.PointLight(0xffffff, 5, 5000); // Increased intensity and distance for larger scene
            pointLight.position.set(0, 0, 0); // Position at the center of the Sun
            scene.add(pointLight);

            // Ambient light to ensure all parts of planets are somewhat visible
            const ambientLight = new THREE.AmbientLight(0x777777); // Brighter ambient light for overall visibility
            scene.add(ambientLight);

            // Create planets and their orbital rings
            planetData.forEach(data => {
                const geometry = new THREE.SphereGeometry(data.radius, 32, 32);
                // Initialize planet with a placeholder material, will be updated by textureLoader.load callback
                const material = new THREE.MeshStandardMaterial({ color: data.color });
                const planet = new THREE.Mesh(geometry, material);

                // Load planet texture, with a fallback to its default color if loading fails
                textureLoader.load(data.texture,
                    function (texture) {
                        planet.material.map = texture;
                        planet.material.needsUpdate = true;
                    },
                    undefined, // onProgress callback
                    function (err) {
                        console.error(`An error happened loading the ${data.name} texture:`, err);
                        // Fallback to initial color if texture fails to load
                        // Material is already set to initial color, no need to change it again
                    }
                );

                // Create a Group to hold the planet and allow it to orbit around the origin
                const planetGroup = new THREE.Group();
                planetGroup.add(planet);
                scene.add(planetGroup);

                // Set initial position of the planet within its group
                planet.position.x = data.distanceFromSun;

                // Create orbital ring for visual confirmation
                const orbitGeometry = new THREE.TorusGeometry(data.distanceFromSun, 3, 16, 100); // Radius, tube, radial segments, tubular segments
                const orbitMaterial = new THREE.MeshBasicMaterial({ color: 0x555555, side: THREE.DoubleSide }); // Grey color
                const orbitRing = new THREE.Mesh(orbitGeometry, orbitMaterial);
                orbitRing.rotation.x = Math.PI / 2; // Rotate to lie flat on the XZ plane
                scene.add(orbitRing); // Add ring directly to the scene, centered at (0,0,0)

                planets.push({
                    mesh: planet, // The actual planet sphere
                    group: planetGroup, // The group that orbits the sun
                    name: data.name,
                    radius: data.radius,
                    distanceFromSun: data.distanceFromSun,
                    orbitalSpeed: (1 / data.orbitalPeriod) * 1000,
                    axialRotationSpeed: data.axialRotation,
                    orbitAngle: Math.random() * Math.PI * 2
                });
            });

            // Add background stars (particle system)
            addStars();

            // Setup event listeners
            window.addEventListener('resize', onWindowResize);
            document.getElementById('pauseResumeBtn').addEventListener('click', togglePauseResume);
            document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
            window.addEventListener('mousemove', onMouseMove, false);

            // Populate control panel with sliders
            createControlPanel();
        }

        /**
         * Adds a background of stars to the scene.
         */
        function addStars() {
            const starsGeometry = new THREE.BufferGeometry();
            const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });

            const starVertices = [];
            for (let i = 0; i < 10000; i++) {
                const x = THREE.MathUtils.randFloatSpread(5000); // Increased spread for more stars in a much larger space
                const y = THREE.MathUtils.randFloatSpread(5000);
                const z = THREE.MathUtils.randFloatSpread(5000);
                starVertices.push(x, y, z);
            }
            starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
            const stars = new THREE.Points(starsGeometry, starsMaterial);
            scene.add(stars);
        }

        /**
         * Creates the control panel elements for each planet's speed.
         */
        function createControlPanel() {
            const controlsList = document.getElementById('planet-controls-list');
            planets.forEach((planet, index) => {
                const controlDiv = document.createElement('div');
                controlDiv.className = 'planet-control'; // Use custom CSS class for consistent styling

                const label = document.createElement('label');
                label.textContent = planet.name;
                label.htmlFor = `speed-slider-${index}`;

                const slider = document.createElement('input');
                slider.type = 'range';
                slider.id = `speed-slider-${index}`;
                slider.min = 0;
                // Adjusted max value for slider to accommodate new planet speeds
                slider.max = planet.orbitalSpeed * 2;
                slider.step = 0.1;
                slider.value = planet.orbitalSpeed; // Initial value

                const speedValueSpan = document.createElement('span');
                speedValueSpan.className = 'speed-value';
                speedValueSpan.textContent = planet.orbitalSpeed.toFixed(1);

                slider.addEventListener('input', (event) => {
                    planet.orbitalSpeed = parseFloat(event.target.value);
                    speedValueSpan.textContent = planet.orbitalSpeed.toFixed(1);
                });

                controlDiv.appendChild(label);
                controlDiv.appendChild(slider);
                controlDiv.appendChild(speedValueSpan);
                controlsList.appendChild(controlDiv);
            });
        }

        /**
         * Handles window resize events to update camera aspect ratio and renderer size.
         */
        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        /**
         * Toggles the pause/resume state of the animation.
         */
        function togglePauseResume() {
            isPaused = !isPaused;
            const button = document.getElementById('pauseResumeBtn');
            button.textContent = isPaused ? 'Resume' : 'Pause';
            // No CSS transition here, state change is immediate.
        }

        /**
         * Toggles between dark and light themes for the UI.
         */
        function toggleTheme() {
            document.body.classList.toggle('light-mode');
            // No CSS transition here, state change is immediate.
            const panel = document.getElementById('control-panel');
            if (document.body.classList.contains('light-mode')) {
                panel.style.backgroundColor = '#ffffff';
                panel.style.borderColor = '#d1d5db';
            } else {
                panel.style.backgroundColor = '#161b22';
                panel.style.borderColor = '#30363d';
            }
        }

        /**
         * Handles mouse move events for raycasting and showing tooltips.
         * @param {MouseEvent} event - The mouse event object.
         */
        function onMouseMove(event) {
            // Calculate mouse position in normalized device coordinates (-1 to +1)
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            // Update the raycaster with the camera and mouse position
            raycaster.setFromCamera(mouse, camera);

            // Calculate objects intersecting the raycaster
            const intersects = raycaster.intersectObjects(planets.map(p => p.mesh));

            if (intersects.length > 0) {
                // If the intersected object is a planet
                const foundPlanet = planets.find(p => p.mesh === intersects[0].object);
                if (foundPlanet && intersectedPlanet !== foundPlanet) {
                    // New planet hovered
                    if (intersectedPlanet) {
                        // Reset previous planet's material if it was changed
                        intersectedPlanet.mesh.material.emissive.setHex(0);
                    }
                    intersectedPlanet = foundPlanet;
                    // Highlight the hovered planet (optional, but good for feedback)
                    intersectedPlanet.mesh.material.emissive.setHex(0x0000ff); // Blue glow

                    // Show tooltip
                    tooltip.textContent = foundPlanet.name;
                    tooltip.style.left = `${event.clientX + 10}px`;
                    tooltip.style.top = `${event.clientY + 10}px`;
                    tooltip.style.opacity = 1;
                    tooltip.style.display = 'block';
                }
            } else {
                // No intersection
                if (intersectedPlanet) {
                    // Remove highlight from previously intersected planet
                    intersectedPlanet.mesh.material.emissive.setHex(0);
                }
                intersectedPlanet = null;
                // Hide tooltip
                tooltip.style.opacity = 0;
                // Use a small delay before hiding to allow CSS transition to play (this is JS-controlled, not CSS transition)
                setTimeout(() => { tooltip.style.display = 'none'; }, 200);
            }
        }

        /**
         * Animation loop function.
         */
        function animate() {
            requestAnimationFrame(animate); // Request the next frame

            const delta = clock.getDelta(); // Time elapsed since last frame

            if (!isPaused) {
                // Rotate the Sun on its axis
                sun.rotation.y += 0.005;

                // Animate planets
                planets.forEach(p => {
                    // This moves the planet's group in a circular orbit around the origin (where the Sun is)
                    // The X and Z coordinates are calculated based on the orbital angle and distance from the Sun.
                    p.orbitAngle += p.orbitalSpeed * delta * 0.1; // * 0.1 to slow down default speeds
                    const x = Math.cos(p.orbitAngle) * p.distanceFromSun;
                    const z = Math.sin(p.orbitAngle) * p.distanceFromSun;
                    p.group.position.set(x, 0, z); // Move the group around the sun

                    // Rotate the planet on its own axis
                    p.mesh.rotation.y += p.axialRotationSpeed * delta;
                });
            }

            controls.update(); // Update OrbitControls for smooth camera movement
            renderer.render(scene, camera); // Render the scene
        }

        // Initialize and start animation when the window loads
        window.onload = function () {
            init(); // Setup the 3D scene
            animate(); // Start the animation loop
        };