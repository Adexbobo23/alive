class PageLoader {
	constructor(targetDivId) {
		this.targetDiv = document.querySelector("#" + targetDivId);
		if (!this.targetDiv) {
			throw new Error(`Target div with ID "${targetDivId}" not found.`);
		}
	}

	async loadPage(url) {
		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Failed to load page: ${response.status} ${response.statusText}`);
			}
			const content = await response.text()
			var content_parsed = content.split("---------script------")
			
			this.targetDiv.style.display = ""

			if(this.targetDiv.dataset.reload == 1 || !this.targetDiv.innerHTML || this.targetDiv.dataset.url != url){
				this.targetDiv.dataset.url = url
				this.targetDiv.innerHTML = content_parsed[0];

				if (content_parsed.length > 1) {
					content_parsed[1] = content_parsed[1].replaceAll("<script>", "").replaceAll("</script>", "");
					try {
						const dynamicScript = new Function(content_parsed[1]); // Creates a function from the string
						setTimeout(() => {
							dynamicScript(); // Executes the script
						}, 100);
					} catch (error) {
						console.error("Error executing dynamic script:", error);
					}
				}
			}
		} catch (error) {
			console.error("Error loading page:", error);
			this.targetDiv.innerHTML = `<p style="color: red;">Error loading page: ${error.message}</p>`;
		}
	}
}

window.ailive = {
    init: function() {
		ailive.pages.load("agents-humanoid-skill")
		//ailive.account.login.popup(true)
		

		document.body.style.cursor = "url('/src/img/cursor.png'), auto";
		// Change the cursor on hover and click using JavaScript
		document.body.addEventListener('mousedown', () => {
			document.body.style.cursor = "url('/src/img/cursor-click.png'), auto";
		});
	
		document.body.addEventListener('mouseup', () => {
			document.body.style.cursor = "url('/src/img/cursor.png'), auto";
		});
    },
    pages: {
        loaders: [], // Placeholder for the loader to avoid undefined access
        load: async function(page_slug, add_to_history = true, reset_history = false) {
				let parent_cat = page_slug.split("-")[0]
				let cleaned = page_slug.split("?")[0]
				
				if(["competitions", "marketplace"].includes(parent_cat)){
					ailive.alert.view("Hold Tight!", "This page will be live soon.<br>Stay tuned—great things are on the way!")
				} else {
					if(reset_history){
						ailive.pages.history.urls = []
						document.querySelector("#nav-goback").style.opacity = 0
					}
					if (add_to_history) {
						const urls = ailive.pages.history.urls;
						if (!urls.length || urls[urls.length - 1] !== page_slug) {
							urls.push(page_slug);
						}
					}

					document.querySelector("#nav-goback").style.opacity = (ailive.pages.history.urls.length > 1) ? 1 : 0

					const target_el_id = "content-" + cleaned
					const pages_container = document.querySelector(".pages-container");

					if(!ailive.pages.loaders[cleaned]){
						if(!pages_container.querySelector("#" + target_el_id)){
							const newDiv = document.createElement("div");
							newDiv.id = target_el_id
							newDiv.classList.add("subpage")
							pages_container.appendChild(newDiv);
						}
						ailive.pages.loaders[cleaned] = new PageLoader(target_el_id);
					}

					pages_container.querySelectorAll(".subpage").forEach(el => {
						el.style.display = "none"
					})

					document.querySelector('#menu')._x_dataStack[0].activePage = cleaned
					document.querySelector('#menu')._x_dataStack[0].submenu = ["agents"].includes(parent_cat) ? parent_cat : ""
					document.querySelector('body')._x_dataStack[0].sidebar = false
				
					ailive.pages.loaders[cleaned].loadPage(`sub/${page_slug}.html`);
				}
        },
		history: {
			urls: [],
			goPrev: function(){
				const urls = ailive.pages.history.urls;

				if (Array.isArray(urls) && urls.length > 1) {
					const lastItem = urls[urls.length - 2]; // Get the last item
					urls.splice(-1, 1); //remove last array
					ailive.pages.load(lastItem, false)	
				} else {
					console.log('Not enough items to process.');
				}
			}
		},
    }, //ailive.popup.open(".modal-login")
	popup: {
		open: function(selector){
			document.querySelector(selector)._x_dataStack[0].open = true
		},
		close: function(selector){
			document.querySelector(selector)._x_dataStack[0].open = false
		},
		closeAll: function(){
			const all_popups = document.querySelectorAll(".modal")
			all_popups.forEach(el => {
				el._x_dataStack[0].open = false
			})
		}
	},
	alert: {
		view: function(title, text){
			const alertModal = document.querySelector(".modal-alert")
			alertModal.querySelector(".modal-title").innerHTML = title
			alertModal.querySelector(".modal-content").innerHTML = text
			ailive.popup.open(".modal-alert")
		},
		close: function(){
			ailive.popup.close(".modal-alert")
		}
	},
	auth: {
		login: {
			popup: function(open){
				ailive.popup.closeAll()
				ailive.popup[open ? "open" : "close"](".modal-login")
			},
			submit: function(){
				
			}
		},
		logout: {
			submit: function(){

			}
		},
		signup: {
			popup: function(open){
				ailive.popup.closeAll()
				ailive.popup[open ? "open" : "close"](".modal-signup")
			},
			submit: function(){

			}
		},
		waitlist: {
			popup: function(open){
				document.querySelector("#waitlist-email").value = ""
				document.querySelector(".modal-waitlist .alert-success").style.display = "none"
				document.querySelector(".modal-waitlist .input-area").style.display = ""
				ailive.popup.closeAll()
				ailive.popup[open ? "open" : "close"](".modal-waitlist")
			},
			submit: function(){ //ailive.auth.waitlist.submit()
				fetch('https://api.ailive.co/v1/waitlist/join', {
					method: 'POST', // HTTP method
					headers: {
						'Content-Type': 'application/json', // Tell the server we're sending JSON
					},
					body: JSON.stringify({
						email: document.querySelector("#waitlist-email").value
					}), // Convert JavaScript object to JSON string
				}).then(response => {
						if (!response.ok) {
							throw new Error(`HTTP error! status: ${response.status}`);
						}
						return response.json(); // Parse JSON response
					})
					.then(data => {
						document.querySelector(".modal-waitlist .alert-success").style.display = "block"
						document.querySelector(".modal-waitlist .input-area").style.display = "none"

						console.log('Success:', data); // Handle the response data
					})
					.catch(error => {
						console.error('Error:', error); // Handle any errors
					});
				
			}
		}
	},
	iframes: {
		//ailive.iframes.send("trainings", "actiontextt", "msgtexxtt")
		send(target, action, message) {

			return;






			let iframe_id, iframe_domain;
		
			// Define domain and iframe ID based on the target
			if (target === "trainings") {
				iframe_domain = 'https://teeees.co:8890';
				iframe_id = 'iframe-trainings';
			} else {
				console.warn(`Unknown target: ${target}`);
				return; // Exit if the target is not recognized
			}
		
			// Get the iframe element
			const iframe = document.getElementById(iframe_id);
			if (!iframe) {
				console.error(`Iframe with ID "${iframe_id}" not found.`);
				return; // Exit if the iframe does not exist
			}
		
			// Send the message to the iframe
			try {
				iframe.contentWindow.postMessage(
					{ action: action, message: message }, 
					iframe_domain
				);
				console.log(`Message sent to ${iframe_domain}:`, { action, message });
			} catch (error) {
				console.error(`Error sending message to iframe:`, error);
			}
		}		
	},
	trainings: {
		init: async function() {
			ailive.trainings.engine = new MuJoCoDemo();
			await ailive.trainings.engine.init();
		},
		render: function(step_data){
			// Ensure the timestep index is within bounds
		},
		replay_actions: {
			sessions: {}, // Changed to an object
			get_data: async function(session_id, replay_index = 0, replay_url, score, is_live) {
				try {
					const response = await fetch(replay_url);
					if (!response.ok) {
						throw new Error(`Failed to load page: ${response.status} ${response.statusText}`);
					}
					const content = await response.text();
					let JSON_content;
					try {
						JSON_content = JSON.parse(content);
					} catch (parseError) {
						console.error("Error parsing JSON:", parseError);
						return;
					}
					setTimeout(() => {
						this.sessions[session_id] = JSON_content; // Fixed session storage
						this.run(session_id, replay_index, replay_url, score, is_live); // Use `this` instead of full path
					}, 100);
				} catch (error) {
					console.error("Error loading page:", error);
				}
			},
			interval: {},
			run: function(session_id, replay_index = 0, replay_url, score, is_live = false) {
				if(!this.latest_played_id) this.latest_played_id = 1;

				if(ailive.trainings.replay_actions.interval){
					clearInterval(ailive.trainings.replay_actions.interval)
					ailive.trainings.replay_actions.interval = null
				}

				if (!(session_id in this.sessions)) { // Fixed check for object
					this.get_data(session_id, replay_index, replay_url, score, is_live);
					return;
				}
				const data = this.sessions[session_id];
				//window.simulation.seed = 500;

				if (Array.isArray(data) && Array.isArray(data[0]) && Array.isArray(data[0][replay_index])) {
					if(is_live){
						document.querySelector("#training-screen").innerHTML = `
							<h3 class="text-primary-300 font-semibold flex items-center gap-2 text-red-500 animate-pulse ">
								<i class="bi bi-camera-video-fill flex"></i> Live
							</h3>
							<p class="text-sm">Session: #${session_id}</p>`
					} else {
						document.querySelector("#training-screen").innerHTML = `
							<h3 class="text-primary-300 font-semibold flex items-center gap-2">
								<i class="bi bi-clock-history flex"></i> Replay
							</h3>
							<p class="text-sm">Session: #${session_id}</p>`
					}

					document.querySelector('#training-screen-score').innerHTML = score;
					
					const step_datas = data[replay_index]
					this.step = 0;
					this.latest_played_id++
					const this_id = this.latest_played_id
					ailive.trainings.replay_actions.interval = setInterval(() => {
						if(this_id != this.latest_played_id) return

						if (this.step < step_datas?.length) {
							//ailive.trainings.render(step_datas[this.step]); // Apply the current timestep
							/*for (let i = 0; i < 17; i++) {
								window.simulation.ctrl[i] = step_datas[this.step][i];
							}*/
							//for (let i = 0; i < 17; i++) {
							//	window.simulation.ctrl[i] = step_datas[this.step][i];
							//}
							ailive.trainings.engine.updateModelWithObservation(step_datas[this.step])

							window.simulation.step();
							window.simulation.step();
							window.simulation.step();
							window.simulation.step();

							this.step++
						} else {
							console.log("Simulation complete.");
							clearInterval(ailive.trainings.replay_actions.interval); // Stop the interval when all timesteps are applied
							setTimeout(() => {
								replay_index = Math.floor(Math.random() * data.length);
								window.simulation.resetData()
								this.run(session_id, replay_index, replay_url, score, is_live)
							}, 20);
						}
					}, 20); // Run every 20 ms

				} else {
					console.error("Unexpected data structure:", data);
				}
			}
		}
	}
};


function phaseCountdown() {
    // Set the static target time (e.g., December 31, 2024, 12:00:00)
	const targetTime = new Date('2025-01-06T00:00:00Z');

    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      interval: null,
      updateCountdown() {
        const now = new Date();
        const difference = targetTime - now;

        if (difference <= 0) {
          clearInterval(this.interval);
          this.days = 0;
          this.hours = 0;
          this.minutes = 0;
          this.seconds = 0;
        } else {
          this.days = Math.floor(difference / (1000 * 60 * 60 * 24));
          this.hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
          this.minutes = Math.floor((difference / (1000 * 60)) % 60);
          this.seconds = Math.floor((difference / 1000) % 60);
        }
      },
      init() {
        this.updateCountdown();
        this.interval = setInterval(() => this.updateCountdown(), 1000);
      }
    };
}

function counter(end, duration) {
	return {
	  current: 0, // start
	  counting: false, // check
  
	  // Format
	  formatNumber(num) {
		return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	  },
  
	  startCounting() {
		// formater
		end = parseInt(end.toString().replace(/,/g, ''), 10); 
  
		// prevent
		if (this.counting || this.current >= end) return;
		
		this.counting = true;
  
		const start = this.current;
		const range = end - start;
		const startTime = performance.now();
  
		const update = (now) => {
		  const elapsedTime = now - startTime;
		  if (elapsedTime < duration * 1000) {
			const progress = elapsedTime / (duration * 1000);
			this.current = Math.round(start + progress * range); // Tetap numerik untuk penghitungan
			requestAnimationFrame(update);
		  } else {
			// complete
			this.current = end;
			this.counting = false; // Reset
		  }
		};
  
		requestAnimationFrame(update);
	  }
	};
  }