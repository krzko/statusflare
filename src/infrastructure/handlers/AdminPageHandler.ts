// Define Env interface locally since types file may not exist
export interface Env {
	STATUSFLARE_ADMIN_PASSWORD: string;
	[key: string]: any;
}

export interface AuthResult {
	authenticated: boolean;
	response: Response;
}

export class AdminPageHandler {
	checkAdminAuth(request: Request, env: Env): AuthResult {
		const authHeader = request.headers.get('Authorization');
		const expectedAuth = `Basic ${btoa(`admin:${env.STATUSFLARE_ADMIN_PASSWORD}`)}`;

		if (!authHeader || authHeader !== expectedAuth) {
			return {
				authenticated: false,
				response: new Response('Unauthorized', {
					status: 401,
					headers: {
						'WWW-Authenticate': 'Basic realm="Admin Area"',
					},
				}),
			};
		}

		return {
			authenticated: true,
			response: new Response(), // This won't be used when authenticated is true
		};
	}

	async handleAdminPage(request: Request, env: Env): Promise<Response> {
		// Check authentication
		const authResult = this.checkAdminAuth(request, env);
		if (!authResult.authenticated) {
			return authResult.response;
		}
		const adminHtml = `<!DOCTYPE html>
<html lang="en-AU">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Status Admin</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 1000px; margin: 2rem auto; padding: 0 1rem; }
        .form-group { margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
        input, select, textarea { width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
        button { background: #3b82f6; color: white; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
        
        /* Tabs */
        .tabs { display: flex; margin-bottom: 2rem; border-bottom: 1px solid #ccc; }
        .tab { padding: 1rem 2rem; cursor: pointer; border-bottom: 2px solid transparent; }
        .tab.active { border-bottom: 2px solid #3b82f6; color: #3b82f6; font-weight: 600; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        
        /* Lists */
        .item-list { margin-top: 2rem; }
        .item { padding: 1rem; border: 1px solid #ccc; margin-bottom: 1rem; border-radius: 4px; }
        .item-actions { margin-top: 1rem; display: flex; gap: 0.5rem; }
        .edit-btn { background: #059669; }
        .edit-btn:hover { background: #047857; }
        .cancel-btn { background: #6b7280; }
        .cancel-btn:hover { background: #4b5563; }
        .editing { background-color: #f0f9ff; border-color: #0ea5e9; }
        
        /* Two column layout */
        .two-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
        
        /* Monitor type fields */
        .monitor-fields { margin: 1rem 0; padding: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; }
        .monitor-fields small { color: #6b7280; font-size: 0.875rem; }
        .monitor-fields code { background: #e5e7eb; padding: 0.25rem 0.5rem; border-radius: 2px; font-size: 0.875rem; }
        
        /* Status banner */
        .status-banner { margin-bottom: 2rem; }
        .banner-form { display: grid; grid-template-columns: 2fr 1fr auto; gap: 1rem; align-items: end; }
        .current-banner { padding: 1rem; border-radius: 4px; margin-bottom: 1rem; color: white; background: #059669; }
    </style>
</head>
<body>
    <h1>Status Admin</h1>
    
    <div class="tabs">
        <div class="tab active" onclick="showTab('categories')">Categories</div>
        <div class="tab" onclick="showTab('services')">Services</div>
        <div class="tab" onclick="showTab('slos')">SLOs</div>
        <div class="tab" onclick="showTab('notifications')">Notifications</div>
        <div class="tab" onclick="showTab('incidents')">Incidents</div>
        <div class="tab" onclick="showTab('settings')">Settings</div>
    </div>
    
    <!-- Categories Tab -->
    <div id="categories-content" class="tab-content active">
        <h2>Manage Categories</h2>
        <form id="category-form">
            <div class="two-columns">
                <div class="form-group">
                    <label>Category Name</label>
                    <input type="text" id="category-name" required>
                </div>
                <div class="form-group">
                    <label>Display Order</label>
                    <input type="number" id="category-order" value="0">
                </div>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="category-description" rows="2"></textarea>
            </div>
            <button type="submit">Add Category</button>
        </form>
        <div class="item-list" id="categories"></div>
    </div>
    
    <!-- Services Tab -->
    <div id="services-content" class="tab-content">
        <h2>Manage Services</h2>
        <form id="service-form">
            <div class="two-columns">
                <div class="form-group">
                    <label>Service Name</label>
                    <input type="text" id="service-name" required>
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <select id="service-category" required>
                        <option value="">Select a category</option>
                    </select>
                </div>
            </div>
            <div class="two-columns">
                <div class="form-group">
                    <label>Monitor Type</label>
                    <select id="service-monitor-type" onchange="toggleMonitorFields()">
                        <option value="http">HTTP/HTTPS Monitor</option>
                        <option value="keyword">Keyword Monitor</option>
                        <option value="api">API Monitor</option>
                        <option value="database">Database Monitor (PostgreSQL/MySQL)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Timeout (ms)</label>
                    <input type="number" id="service-timeout" value="5000">
                </div>
            </div>
            
            <!-- HTTP Monitor specific fields -->
            <div id="http-fields" class="monitor-fields">
                <div class="two-columns">
                    <div class="form-group">
                        <label>URL</label>
                        <input type="url" id="service-url" required>
                    </div>
                    <div class="form-group">
                        <label>Method</label>
                        <select id="service-method">
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="HEAD">HEAD</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                    </div>
                </div>
                <div class="two-columns">
                    <div class="form-group">
                        <label>Expected Status Code</label>
                        <input type="number" id="service-expectedStatus" value="200">
                    </div>
                    <div class="form-group">
                        <label>Expected Content (Optional)</label>
                        <input type="text" id="service-expectedContent" placeholder="Optional text to find in response">
                    </div>
                </div>
            </div>
            
            <!-- Keyword Monitor specific fields -->
            <div id="keyword-fields" class="monitor-fields" style="display: none;">
                <div class="two-columns">
                    <div class="form-group">
                        <label>URL</label>
                        <input type="url" id="service-url-keyword" required>
                    </div>
                    <div class="form-group">
                        <label>Method</label>
                        <select id="service-method-keyword">
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="HEAD">HEAD</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Keyword to Search For</label>
                    <input type="text" id="service-keyword" placeholder="Enter keyword or phrase to search for">
                    <small style="color: #6b7280; font-size: 0.875rem;">Case-insensitive search in page response</small>
                </div>
            </div>
            
            <!-- API Monitor specific fields -->
            <div id="api-fields" class="monitor-fields" style="display: none;">
                <div class="two-columns">
                    <div class="form-group">
                        <label>URL</label>
                        <input type="url" id="service-url-api" required>
                    </div>
                    <div class="form-group">
                        <label>Method</label>
                        <select id="service-method-api">
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="HEAD">HEAD</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Request Body (JSON, Optional)</label>
                    <textarea id="service-requestBody" rows="3" placeholder='{"key": "value"}'></textarea>
                </div>
                <div class="form-group">
                    <label>Request Headers (JSON, Optional)</label>
                    <textarea id="service-requestHeaders" rows="2" placeholder='{"Content-Type": "application/json"}'></textarea>
                </div>
                <div class="form-group">
                    <label>Bearer Token (Optional)</label>
                    <input type="text" id="service-bearerToken" placeholder="Authentication token">
                </div>
            </div>
            
            <!-- Database Monitor specific fields -->
            <div id="database-fields" class="monitor-fields" style="display: none;">
                <div class="form-group">
                    <label>Hyperdrive ID</label>
                    <input type="text" id="service-hyperdriveId" placeholder="b5f27764f6f74e1a9d72089b2445e21d" required>
                    <small style="color: #6b7280; font-size: 0.875rem;">Hyperdrive configuration ID from wrangler hyperdrive create command</small>
                </div>
                <div class="form-group">
                    <label>Query (Optional)</label>
                    <textarea id="service-databaseQuery" rows="2" placeholder="SELECT 1">SELECT 1</textarea>
                    <small style="color: #6b7280; font-size: 0.875rem;">SQL query to execute (defaults to "SELECT 1")</small>
                </div>
            </div>
            <button type="submit">Add Service</button>
        </form>
        <div class="item-list" id="services"></div>
    </div>
    
    <!-- SLOs Tab -->
    <div id="slos-content" class="tab-content">
        <h2>Manage SLOs (Service Level Objectives)</h2>
        <form id="slo-form">
            <div class="two-columns">
                <div class="form-group">
                    <label>SLO Name</label>
                    <input type="text" id="slo-name" placeholder="API Availability" required>
                </div>
                <div class="form-group">
                    <label>Service</label>
                    <select id="slo-service" required>
                        <option value="">Select a service</option>
                    </select>
                </div>
            </div>
            <div class="two-columns">
                <div class="form-group">
                    <label>SLI Type</label>
                    <select id="slo-sli-type" onchange="toggleSLOFields()">
                        <option value="availability">Availability</option>
                        <option value="latency">Latency</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Target Percentage</label>
                    <input type="number" id="slo-target" min="90" max="100" step="0.1" value="99.0" required>
                    <small style="color: #6b7280; font-size: 0.875rem;">e.g., 99.0 for 99%</small>
                </div>
            </div>
            <div class="two-columns">
                <div class="form-group" id="latency-threshold-group" style="display: none;">
                    <label>Latency Threshold (ms)</label>
                    <input type="number" id="slo-latency-threshold" min="1" placeholder="500">
                    <small style="color: #6b7280; font-size: 0.875rem;">Max response time for success</small>
                </div>
                <div class="form-group">
                    <label>Time Window (days)</label>
                    <input type="number" id="slo-time-window" min="1" max="90" value="28" required>
                    <small style="color: #6b7280; font-size: 0.875rem;">Period for SLO evaluation</small>
                </div>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="slo-enabled" checked> Enabled
                </label>
            </div>
            <button type="submit">Create SLO</button>
        </form>
        <div class="item-list" id="slos"></div>
    </div>
    
    <!-- Notifications Tab -->
    <div id="notifications-content" class="tab-content">
        <h2>Manage Notification Channels</h2>
        <form id="notification-form">
            <div class="two-columns">
                <div class="form-group">
                    <label>Channel Name</label>
                    <input type="text" id="notification-name" placeholder="Slack Engineering Alerts" required>
                </div>
                <div class="form-group">
                    <label>Channel Type</label>
                    <select id="notification-type" onchange="toggleNotificationFields()">
                        <option value="webhook">Webhook</option>
                        <option value="email">Email (Coming Soon)</option>
                        <option value="sms">SMS (Coming Soon)</option>
                    </select>
                </div>
            </div>
            
            <!-- Webhook specific fields -->
            <div id="webhook-fields" class="monitor-fields">
                <div class="form-group">
                    <label>Webhook URL</label>
                    <input type="url" id="webhook-url" placeholder="https://hooks.slack.com/services/..." required>
                </div>
                <div class="two-columns">
                    <div class="form-group">
                        <label>Format</label>
                        <select id="webhook-format">
                            <option value="slack">Slack</option>
                            <option value="discord">Discord</option>
                            <option value="custom">Custom JSON</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="notification-enabled" checked> Enabled
                        </label>
                    </div>
                </div>
                <div class="form-group">
                    <label>Custom Headers (JSON, Optional)</label>
                    <textarea id="webhook-headers" rows="2" placeholder='{"Authorization": "Bearer token"}'></textarea>
                    <small style="color: #6b7280; font-size: 0.875rem;">Additional HTTP headers for authentication</small>
                </div>
            </div>
            <button type="submit">Create Channel</button>
        </form>
        <div class="item-list" id="notification-channels"></div>
        
        <h2 style="margin-top: 3rem;">SLO Alert Rules</h2>
        <form id="slo-notification-form">
            <div class="two-columns">
                <div class="form-group">
                    <label>SLO</label>
                    <select id="alert-slo" required>
                        <option value="">Select an SLO</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Notification Channel</label>
                    <select id="alert-channel" required>
                        <option value="">Select a channel</option>
                    </select>
                </div>
            </div>
            <div class="two-columns">
                <div class="form-group">
                    <label>Burn Rate Threshold</label>
                    <input type="number" id="alert-threshold" min="1" step="0.1" value="14.4" required>
                    <small style="color: #6b7280; font-size: 0.875rem;">14.4 = 30-day budget in 2 hours</small>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="alert-enabled" checked> Enabled
                    </label>
                </div>
            </div>
            <button type="submit">Create Alert Rule</button>
        </form>
        <div class="item-list" id="slo-notifications"></div>
    </div>
    
    <!-- Incidents Tab -->
    <div id="incidents-content" class="tab-content">
        <h2>Manage Incidents</h2>
        <form id="incident-form">
            <div class="form-group">
                <label>Incident Title</label>
                <input type="text" id="incident-title" required>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="incident-description" rows="3"></textarea>
            </div>
            <div class="two-columns">
                <div class="form-group">
                    <label>Status</label>
                    <select id="incident-status">
                        <option value="identified">Identified</option>
                        <option value="investigating">Investigating</option>
                        <option value="update">Update</option>
                        <option value="resolved">Resolved</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Severity</label>
                    <select id="incident-severity">
                        <option value="minor">Minor</option>
                        <option value="major">Major</option>
                        <option value="critical">Critical</option>
                    </select>
                </div>
            </div>
            <button type="submit">Create Incident</button>
        </form>
        <div class="item-list" id="incidents"></div>
    </div>
    
    <!-- Settings Tab -->
    <div id="settings-content" class="tab-content">
        <h2>System Settings</h2>
        
        <div class="page-config" style="margin-bottom: 2rem;">
            <h3>Page Configuration</h3>
            <form id="page-config-form">
                <div class="form-group">
                    <label>Status Page Title</label>
                    <input type="text" id="page-title" placeholder="Status Page" required>
                </div>
                <button type="submit">Update Page Title</button>
            </form>
        </div>
        
        <div class="status-banner">
            <h3>Status Banner</h3>
            <div id="current-banner" class="current-banner">All Systems Operational</div>
            
            <div class="form-group" style="margin-bottom: 1rem;">
                <label>
                    <input type="checkbox" id="auto-banner" onchange="toggleBannerMode()"> 
                    Automatically update banner based on service status
                </label>
                <small style="display: block; color: #6b7280; font-size: 0.875rem; margin-top: 0.25rem;">
                    When enabled, the banner will automatically reflect the actual system status
                </small>
            </div>
            
            <form id="banner-form" class="banner-form">
                <div id="manual-banner-fields">
                    <div class="form-group">
                        <label>Banner Message</label>
                        <input type="text" id="banner-message" value="All Systems Operational">
                    </div>
                    <div class="form-group">
                        <label>Overall Status</label>
                        <select id="overall-status">
                            <option value="operational">Operational</option>
                            <option value="degraded">Degraded</option>
                            <option value="major_outage">Outage</option>
                        </select>
                    </div>
                    <button type="submit">Update Banner</button>
                </div>
                <div id="auto-banner-info" style="display: none; padding: 1rem; background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 4px; color: #0c4a6e;">
                    <strong>Auto Banner Enabled</strong><br>
                    The banner will automatically update based on your service statuses:
                    <ul style="margin: 0.5rem 0 0 1rem;">
                        <li><strong>Green:</strong> All services operational</li>
                        <li><strong>Orange:</strong> Some services degraded</li>
                        <li><strong>Red:</strong> One or more services down</li>
                    </ul>
                </div>
            </form>
        </div>
    </div>
    
    <script>
        // API key from environment - injected server-side
        const API_KEY = '${env.STATUSFLARE_ADMIN_PASSWORD}';
        
        // Helper function to get auth headers for API requests
        function getAuthHeaders() {
            return {
                'X-API-Key': API_KEY,
                'Content-Type': 'application/json'
            };
        }
        
        // Tab management
        function showTab(tabName) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected tab content
            document.getElementById(tabName + '-content').classList.add('active');
            event.target.classList.add('active');
            
            // Load data for the active tab
            if (tabName === 'categories') loadCategories();
            if (tabName === 'services') loadServices();
            if (tabName === 'slos') loadSLOs();
            if (tabName === 'notifications') loadNotifications();
            if (tabName === 'incidents') loadIncidents();
            if (tabName === 'settings') loadSettings();
        }
        
        // Monitor type field toggle
        function toggleMonitorFields() {
            const monitorType = document.getElementById('service-monitor-type').value;
            
            // Hide all monitor-specific fields and remove required attributes
            document.getElementById('http-fields').style.display = 'none';
            document.getElementById('keyword-fields').style.display = 'none';
            document.getElementById('api-fields').style.display = 'none';
            document.getElementById('database-fields').style.display = 'none';
            
            // Remove required attributes from all URL fields
            document.getElementById('service-url').removeAttribute('required');
            document.getElementById('service-url-keyword').removeAttribute('required');
            document.getElementById('service-url-api').removeAttribute('required');
            document.getElementById('service-hyperdriveId').removeAttribute('required');
            
            // Show relevant fields based on monitor type and set required attributes
            if (monitorType === 'http') {
                document.getElementById('http-fields').style.display = 'block';
                document.getElementById('service-url').setAttribute('required', 'required');
            } else if (monitorType === 'keyword') {
                document.getElementById('keyword-fields').style.display = 'block';
                document.getElementById('service-url-keyword').setAttribute('required', 'required');
            } else if (monitorType === 'api') {
                document.getElementById('api-fields').style.display = 'block';
                document.getElementById('service-url-api').setAttribute('required', 'required');
            } else if (monitorType === 'database') {
                document.getElementById('database-fields').style.display = 'block';
                document.getElementById('service-hyperdriveId').setAttribute('required', 'required');
            }
        }
        
        // Monitor type field toggle for edit forms
        function toggleEditMonitorFields(serviceId) {
            const monitorType = document.getElementById('edit-service-monitor-type-' + serviceId).value;
            
            // Hide all monitor-specific fields and remove required attributes
            document.getElementById('edit-http-fields-' + serviceId).style.display = 'none';
            document.getElementById('edit-keyword-fields-' + serviceId).style.display = 'none';
            document.getElementById('edit-api-fields-' + serviceId).style.display = 'none';
            document.getElementById('edit-database-fields-' + serviceId).style.display = 'none';
            
            // Remove required attributes from all URL fields
            document.getElementById('edit-service-url-' + serviceId).removeAttribute('required');
            document.getElementById('edit-service-url-keyword-' + serviceId).removeAttribute('required');
            document.getElementById('edit-service-url-api-' + serviceId).removeAttribute('required');
            document.getElementById('edit-service-hyperdriveId-' + serviceId).removeAttribute('required');
            
            // Show relevant fields based on monitor type and set required attributes
            if (monitorType === 'http') {
                document.getElementById('edit-http-fields-' + serviceId).style.display = 'block';
                document.getElementById('edit-service-url-' + serviceId).setAttribute('required', 'required');
            } else if (monitorType === 'keyword') {
                document.getElementById('edit-keyword-fields-' + serviceId).style.display = 'block';
                document.getElementById('edit-service-url-keyword-' + serviceId).setAttribute('required', 'required');
            } else if (monitorType === 'api') {
                document.getElementById('edit-api-fields-' + serviceId).style.display = 'block';
                document.getElementById('edit-service-url-api-' + serviceId).setAttribute('required', 'required');
            } else if (monitorType === 'database') {
                document.getElementById('edit-database-fields-' + serviceId).style.display = 'block';
                document.getElementById('edit-service-hyperdriveId-' + serviceId).setAttribute('required', 'required');
            }
        }
        
        // Auto banner toggle
        function toggleBannerMode() {
            const autoBanner = document.getElementById('auto-banner').checked;
            const manualFields = document.getElementById('manual-banner-fields');
            const autoInfo = document.getElementById('auto-banner-info');
            
            if (autoBanner) {
                manualFields.style.display = 'none';
                autoInfo.style.display = 'block';
            } else {
                manualFields.style.display = 'block';
                autoInfo.style.display = 'none';
            }
        }
        
        // SLO field toggle
        function toggleSLOFields() {
            const sliType = document.getElementById('slo-sli-type').value;
            const latencyGroup = document.getElementById('latency-threshold-group');
            const latencyInput = document.getElementById('slo-latency-threshold');
            
            if (sliType === 'latency') {
                latencyGroup.style.display = 'block';
                latencyInput.setAttribute('required', 'required');
            } else {
                latencyGroup.style.display = 'none';
                latencyInput.removeAttribute('required');
                latencyInput.value = '';
            }
        }
        
        // Notification field toggle
        function toggleNotificationFields() {
            const type = document.getElementById('notification-type').value;
            const webhookFields = document.getElementById('webhook-fields');
            const webhookUrl = document.getElementById('webhook-url');
            
            if (type === 'webhook') {
                webhookFields.style.display = 'block';
                webhookUrl.setAttribute('required', 'required');
            } else {
                webhookFields.style.display = 'none';
                webhookUrl.removeAttribute('required');
            }
        }
        
        // Categories management
        async function loadCategories() {
            try {
                const response = await fetch('/api/categories', {
                    headers: getAuthHeaders()
                });
                const categories = await response.json();
                const container = document.getElementById('categories');
                container.innerHTML = categories.map(category => 
                    '<div class="item" id="category-' + category.id + '">' +
                        '<div class="category-display" id="category-display-' + category.id + '">' +
                            '<h3>' + category.name + '</h3>' +
                            '<p><strong>Description:</strong> ' + (category.description || 'No description') + '</p>' +
                            '<p><strong>Display Order:</strong> ' + category.displayOrder + '</p>' +
                            '<p><strong>Status:</strong> ' + (category.enabled ? 'Enabled' : 'Disabled') + '</p>' +
                            '<div class="item-actions">' +
                                '<button class="edit-btn" onclick="editCategory(' + category.id + ')">Edit</button>' +
                                '<button onclick="deleteCategory(' + category.id + ')">Delete</button>' +
                            '</div>' +
                        '</div>' +
                        '<div class="category-edit" id="category-edit-' + category.id + '" style="display: none;">' +
                            '<div class="form-group">' +
                                '<label>Category Name</label>' +
                                '<input type="text" id="edit-category-name-' + category.id + '" value="' + category.name + '" required>' +
                            '</div>' +
                            '<div class="form-group">' +
                                '<label>Description</label>' +
                                '<textarea id="edit-category-description-' + category.id + '" rows="2">' + (category.description || '') + '</textarea>' +
                            '</div>' +
                            '<div class="form-group">' +
                                '<label>Display Order</label>' +
                                '<input type="number" id="edit-category-order-' + category.id + '" value="' + category.displayOrder + '">' +
                            '</div>' +
                            '<div class="form-group">' +
                                '<label>' +
                                    '<input type="checkbox" id="edit-category-enabled-' + category.id + '"' + (category.enabled ? ' checked' : '') + '> Enabled' +
                                '</label>' +
                            '</div>' +
                            '<div class="item-actions">' +
                                '<button onclick="saveCategory(' + category.id + ')">Save</button>' +
                                '<button class="cancel-btn" onclick="cancelEditCategory(' + category.id + ')">Cancel</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>'
                ).join('');
                
                // Populate service category dropdown
                const serviceSelect = document.getElementById('service-category');
                serviceSelect.innerHTML = '<option value="">Select a category</option>' + 
                    categories.map(cat => '<option value="' + cat.id + '">' + cat.name + '</option>').join('');
            } catch (error) {
                console.error('Error loading categories:', error);
            }
        }
        
        async function deleteCategory(id) {
            if (confirm('Are you sure you want to delete this category?')) {
                try {
                    const response = await fetch('/api/categories?id=' + id, { 
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        alert(errorData.error || 'Failed to delete category');
                        return;
                    }
                    
                    loadCategories();
                    alert('Category deleted successfully');
                } catch (error) {
                    console.error('Error deleting category:', error);
                    alert('Failed to delete category. Please try again.');
                }
            }
        }
        
        function editCategory(id) {
            document.getElementById('category-display-' + id).style.display = 'none';
            document.getElementById('category-edit-' + id).style.display = 'block';
            document.getElementById('category-' + id).classList.add('editing');
        }
        
        function cancelEditCategory(id) {
            document.getElementById('category-display-' + id).style.display = 'block';
            document.getElementById('category-edit-' + id).style.display = 'none';
            document.getElementById('category-' + id).classList.remove('editing');
        }
        
        async function saveCategory(id) {
            const data = {
                name: document.getElementById('edit-category-name-' + id).value,
                description: document.getElementById('edit-category-description-' + id).value,
                displayOrder: parseInt(document.getElementById('edit-category-order-' + id).value),
                enabled: document.getElementById('edit-category-enabled-' + id).checked,
            };
            
            try {
                const response = await fetch('/api/categories?id=' + id, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data),
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    alert('Error updating category: ' + (errorData.error || 'Unknown error'));
                    return;
                }
                
                cancelEditCategory(id);
                loadCategories();
                alert('Category updated successfully!');
            } catch (error) {
                console.error('Error updating category:', error);
                alert('Failed to update category. Please try again.');
            }
        }
        
        // Services management
        async function loadServices() {
            try {
                const response = await fetch('/api/services', {
                    headers: getAuthHeaders()
                });
                const services = await response.json();
                const container = document.getElementById('services');
                container.innerHTML = services.map(service => {
                    const monitorType = service.monitorType || 'http';
                    let monitorDetails = '';
                    
                    if (monitorType === 'http') {
                        monitorDetails = '<p><strong>Expected Status:</strong> ' + service.expectedStatus + '</p>';
                        if (service.expectedContent) {
                            monitorDetails += '<p><strong>Expected Content:</strong> ' + service.expectedContent + '</p>';
                        }
                    } else if (monitorType === 'keyword') {
                        monitorDetails = '<p><strong>Keyword:</strong> ' + (service.keyword || 'Not specified') + '</p>';
                    } else if (monitorType === 'api') {
                        monitorDetails = '<p><strong>Monitor:</strong> API (expects 2xx status)</p>';
                        if (service.requestBody) {
                            monitorDetails += '<p><strong>Request Body:</strong> <code>' + service.requestBody + '</code></p>';
                        }
                        if (service.bearerToken) {
                            monitorDetails += '<p><strong>Authentication:</strong> Bearer token configured</p>';
                        }
                    } else if (monitorType === 'database') {
                        monitorDetails = '<p><strong>Monitor:</strong> Database (PostgreSQL/MySQL)</p>';
                        if (service.hyperdriveId) {
                            monitorDetails += '<p><strong>Hyperdrive ID:</strong> <code>' + service.hyperdriveId + '</code></p>';
                        }
                        monitorDetails += '<p><strong>Query:</strong> <code>' + (service.databaseQuery || 'SELECT 1') + '</code></p>';
                    }
                    
                    return \`
                    <div class="item" id="service-\${service.id}">
                        <div class="service-display" id="service-display-\${service.id}">
                            <h3>\${service.name}</h3>
                            \${monitorType !== 'database' ? \`<p><strong>URL:</strong> \${service.url}</p>\` : ''}
                            <p><strong>Monitor Type:</strong> \${monitorType.toUpperCase()}</p>
                            \${monitorType !== 'database' ? \`<p><strong>Method:</strong> \${service.method}</p>\` : ''}
                            \${monitorDetails}
                            <p><strong>Timeout:</strong> \${service.timeoutMs}ms</p>
                            <p><strong>Category:</strong> \${service.categoryId || 'Uncategorised'}</p>
                            <p><strong>Status:</strong> \${service.enabled ? 'Enabled' : 'Disabled'}</p>
                            <div class="item-actions">
                                <button class="edit-btn" onclick="editService(\${service.id})">Edit</button>
                                <button onclick="deleteService(\${service.id})">Delete</button>
                            </div>
                        </div>
                        <div class="service-edit" id="service-edit-\${service.id}" style="display: none;">
                            <div class="two-columns">
                                <div class="form-group">
                                    <label>Service Name</label>
                                    <input type="text" id="edit-service-name-\${service.id}" value="\${service.name}" required>
                                </div>
                                <div class="form-group">
                                    <label>Category</label>
                                    <select id="edit-service-category-\${service.id}">
                                        <option value="">Select a category</option>
                                    </select>
                                </div>
                            </div>
                            <div class="two-columns">
                                <div class="form-group">
                                    <label>Monitor Type</label>
                                    <select id="edit-service-monitor-type-\${service.id}" onchange="toggleEditMonitorFields(\${service.id})">
                                        <option value="http" \${monitorType === 'http' ? 'selected' : ''}>HTTP/HTTPS Monitor</option>
                                        <option value="keyword" \${monitorType === 'keyword' ? 'selected' : ''}>Keyword Monitor</option>
                                        <option value="api" \${monitorType === 'api' ? 'selected' : ''}>API Monitor</option>
                                        <option value="database" \${monitorType === 'database' ? 'selected' : ''}>Database Monitor (PostgreSQL/MySQL)</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Timeout (ms)</label>
                                    <input type="number" id="edit-service-timeout-\${service.id}" value="\${service.timeoutMs}">
                                </div>
                            </div>
                            
                            <!-- HTTP Monitor specific fields -->
                            <div id="edit-http-fields-\${service.id}" class="monitor-fields" style="display: \${monitorType === 'http' ? 'block' : 'none'};">
                                <div class="two-columns">
                                    <div class="form-group">
                                        <label>URL</label>
                                        <input type="url" id="edit-service-url-\${service.id}" value="\${service.url}" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Method</label>
                                        <select id="edit-service-method-\${service.id}">
                                            <option value="GET" \${service.method === 'GET' ? 'selected' : ''}>GET</option>
                                            <option value="POST" \${service.method === 'POST' ? 'selected' : ''}>POST</option>
                                            <option value="HEAD" \${service.method === 'HEAD' ? 'selected' : ''}>HEAD</option>
                                            <option value="PUT" \${service.method === 'PUT' ? 'selected' : ''}>PUT</option>
                                            <option value="DELETE" \${service.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="two-columns">
                                    <div class="form-group">
                                        <label>Expected Status Code</label>
                                        <input type="number" id="edit-service-expectedStatus-\${service.id}" value="\${service.expectedStatus || 200}">
                                    </div>
                                    <div class="form-group">
                                        <label>Expected Content (Optional)</label>
                                        <input type="text" id="edit-service-expectedContent-\${service.id}" value="\${service.expectedContent || ''}" placeholder="Optional text to find in response">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Keyword Monitor specific fields -->
                            <div id="edit-keyword-fields-\${service.id}" class="monitor-fields" style="display: \${monitorType === 'keyword' ? 'block' : 'none'};">
                                <div class="two-columns">
                                    <div class="form-group">
                                        <label>URL</label>
                                        <input type="url" id="edit-service-url-keyword-\${service.id}" value="\${service.url}" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Method</label>
                                        <select id="edit-service-method-keyword-\${service.id}">
                                            <option value="GET" \${service.method === 'GET' ? 'selected' : ''}>GET</option>
                                            <option value="POST" \${service.method === 'POST' ? 'selected' : ''}>POST</option>
                                            <option value="HEAD" \${service.method === 'HEAD' ? 'selected' : ''}>HEAD</option>
                                            <option value="PUT" \${service.method === 'PUT' ? 'selected' : ''}>PUT</option>
                                            <option value="DELETE" \${service.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>Keyword to Search For</label>
                                    <input type="text" id="edit-service-keyword-\${service.id}" value="\${service.keyword || ''}" placeholder="Enter keyword or phrase to search for">
                                    <small style="color: #6b7280; font-size: 0.875rem;">Case-insensitive search in page response</small>
                                </div>
                            </div>
                            
                            <!-- API Monitor specific fields -->
                            <div id="edit-api-fields-\${service.id}" class="monitor-fields" style="display: \${monitorType === 'api' ? 'block' : 'none'};">
                                <div class="two-columns">
                                    <div class="form-group">
                                        <label>URL</label>
                                        <input type="url" id="edit-service-url-api-\${service.id}" value="\${service.url}" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Method</label>
                                        <select id="edit-service-method-api-\${service.id}">
                                            <option value="GET" \${service.method === 'GET' ? 'selected' : ''}>GET</option>
                                            <option value="POST" \${service.method === 'POST' ? 'selected' : ''}>POST</option>
                                            <option value="HEAD" \${service.method === 'HEAD' ? 'selected' : ''}>HEAD</option>
                                            <option value="PUT" \${service.method === 'PUT' ? 'selected' : ''}>PUT</option>
                                            <option value="DELETE" \${service.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>Request Body (JSON, Optional)</label>
                                    <textarea id="edit-service-requestBody-\${service.id}" rows="3" placeholder='{"key": "value"}'>\${service.requestBody || ''}</textarea>
                                </div>
                                <div class="form-group">
                                    <label>Request Headers (JSON, Optional)</label>
                                    <textarea id="edit-service-requestHeaders-\${service.id}" rows="2" placeholder='{"Content-Type": "application/json"}'>\${service.requestHeaders || ''}</textarea>
                                </div>
                                <div class="form-group">
                                    <label>Bearer Token (Optional)</label>
                                    <input type="text" id="edit-service-bearerToken-\${service.id}" value="\${service.bearerToken || ''}" placeholder="Authentication token">
                                </div>
                            </div>
                            
                            <!-- Database Monitor specific fields -->
                            <div id="edit-database-fields-\${service.id}" class="monitor-fields" style="display: \${monitorType === 'database' ? 'block' : 'none'};">
                                <div class="form-group">
                                    <label>Hyperdrive ID</label>
                                    <input type="text" id="edit-service-hyperdriveId-\${service.id}" value="\${service.hyperdriveId || ''}" placeholder="b5f27764f6f74e1a9d72089b2445e21d">
                                    <small style="color: #6b7280; font-size: 0.875rem;">Hyperdrive configuration ID from wrangler hyperdrive create command</small>
                                </div>
                                <div class="form-group">
                                    <label>Query (Optional)</label>
                                    <textarea id="edit-service-databaseQuery-\${service.id}" rows="2" placeholder="SELECT 1">\${service.databaseQuery || 'SELECT 1'}</textarea>
                                    <small style="color: #6b7280; font-size: 0.875rem;">SQL query to execute (defaults to "SELECT 1")</small>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="edit-service-enabled-\${service.id}" \${service.enabled ? 'checked' : ''}> Enabled
                                </label>
                            </div>
                            <div class="item-actions">
                                <button onclick="saveService(\${service.id})">Save</button>
                                <button class="cancel-btn" onclick="cancelEditService(\${service.id})">Cancel</button>
                            </div>
                        </div>
                    </div>
                \`;
                }).join('');
                
                // Populate category dropdowns in edit forms
                await populateServiceEditCategoryDropdowns(services);
            } catch (error) {
                console.error('Error loading services:', error);
            }
        }
        
        async function deleteService(id) {
            if (confirm('Are you sure? This will remove all historical data.')) {
                try {
                    await fetch('/api/services?id=' + id, { 
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    loadServices();
                } catch (error) {
                    console.error('Error deleting service:', error);
                }
            }
        }
        
        // Incidents management
        async function loadIncidents() {
            try {
                const response = await fetch('/api/incidents', {
                    headers: getAuthHeaders()
                });
                const incidents = await response.json();
                const container = document.getElementById('incidents');
                container.innerHTML = incidents.length > 0 ? incidents.map(incident => \`
                    <div class="item" id="incident-\${incident.id}">
                        <div class="incident-display" id="incident-display-\${incident.id}">
                            <h3>\${incident.title}</h3>
                            <p><strong>Description:</strong> \${incident.description || 'No description'}</p>
                            <p><strong>Status:</strong> \${incident.status}</p>
                            <p><strong>Severity:</strong> \${incident.severity}</p>
                            <p><strong>Started:</strong> \${new Date(incident.startedAt).toLocaleString()}</p>
                            \${incident.resolvedAt ? \`<p><strong>Resolved:</strong> \${new Date(incident.resolvedAt).toLocaleString()}</p>\` : ''}
                            <div class="item-actions">
                                <button class="edit-btn" onclick="editIncident(\${incident.id})">Update</button>
                                <button onclick="deleteIncident(\${incident.id})">Delete</button>
                            </div>
                        </div>
                        <div class="incident-edit" id="incident-edit-\${incident.id}" style="display: none;">
                            <div class="form-group">
                                <label>Incident Title</label>
                                <input type="text" id="edit-incident-title-\${incident.id}" value="\${incident.title}" required>
                            </div>
                            <div class="form-group">
                                <label>Description</label>
                                <textarea id="edit-incident-description-\${incident.id}" rows="3">\${incident.description || ''}</textarea>
                            </div>
                            <div class="two-columns">
                                <div class="form-group">
                                    <label>Status</label>
                                    <select id="edit-incident-status-\${incident.id}">
                                        <option value="identified" \${incident.status === 'identified' ? 'selected' : ''}>Identified</option>
                                        <option value="investigating" \${incident.status === 'investigating' ? 'selected' : ''}>Investigating</option>
                                        <option value="update" \${incident.status === 'update' ? 'selected' : ''}>Update</option>
                                        <option value="resolved" \${incident.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Severity</label>
                                    <select id="edit-incident-severity-\${incident.id}">
                                        <option value="minor" \${incident.severity === 'minor' ? 'selected' : ''}>Minor</option>
                                        <option value="major" \${incident.severity === 'major' ? 'selected' : ''}>Major</option>
                                        <option value="critical" \${incident.severity === 'critical' ? 'selected' : ''}>Critical</option>
                                    </select>
                                </div>
                            </div>
                            <div class="item-actions">
                                <button onclick="saveIncident(\${incident.id})">Save</button>
                                <button class="cancel-btn" onclick="cancelEditIncident(\${incident.id})">Cancel</button>
                            </div>
                        </div>
                    </div>
                \`).join('') : '<p>No incidents reported.</p>';
                
                // Add timeline sections and load data for each incident after rendering
                if (incidents.length > 0) {
                    setTimeout(() => {
                        incidents.forEach(incident => {
                            addTimelineToIncident(incident.id);
                            loadIncidentTimeline(incident.id);
                        });
                    }, 100);
                }
            } catch (error) {
                console.error('Error loading incidents:', error);
            }
        }
        
        async function deleteIncident(id) {
            if (confirm('Are you sure? This will permanently delete the incident.')) {
                try {
                    await fetch('/api/incidents?id=' + id, { 
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    loadIncidents();
                } catch (error) {
                    console.error('Error deleting incident:', error);
                }
            }
        }
        
        function editIncident(id) {
            document.getElementById('incident-display-' + id).style.display = 'none';
            document.getElementById('incident-edit-' + id).style.display = 'block';
            document.getElementById('incident-' + id).classList.add('editing');
        }
        
        function cancelEditIncident(id) {
            document.getElementById('incident-display-' + id).style.display = 'block';
            document.getElementById('incident-edit-' + id).style.display = 'none';
            document.getElementById('incident-' + id).classList.remove('editing');
        }
        
        async function saveIncident(id) {
            const data = {
                title: document.getElementById('edit-incident-title-' + id).value,
                description: document.getElementById('edit-incident-description-' + id).value,
                status: document.getElementById('edit-incident-status-' + id).value,
                severity: document.getElementById('edit-incident-severity-' + id).value,
            };
            
            try {
                await fetch('/api/incidents?id=' + id, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data),
                });
                cancelEditIncident(id);
                loadIncidents();
            } catch (error) {
                console.error('Error updating incident:', error);
                alert('Failed to update incident');
            }
        }
        
        function addTimelineToIncident(incidentId) {
            const displayDiv = document.getElementById('incident-display-' + incidentId);
            if (!displayDiv) return;
            
            // Check if timeline already exists
            if (document.getElementById('timeline-' + incidentId)) return;
            
            const actionsDiv = displayDiv.querySelector('.item-actions');
            if (!actionsDiv) return;
            
            // Create timeline HTML
            const timelineHTML = 
                '<h4>Timeline</h4>' +
                '<div class="incident-timeline" id="timeline-' + incidentId + '">' +
                    '<p>Loading timeline...</p>' +
                '</div>' +
                '<div class="add-update" style="margin-top: 1rem; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 4px; background: #f9fafb;">' +
                    '<h5>Add Status Update</h5>' +
                    '<div class="form-group">' +
                        '<label>Status</label>' +
                        '<select id="new-update-status-' + incidentId + '">' +
                            '<option value="investigating">Investigating</option>' +
                            '<option value="update">Update</option>' +
                            '<option value="resolved">Resolved</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Message</label>' +
                        '<textarea id="new-update-message-' + incidentId + '" rows="2" placeholder="Describe the current status..." required></textarea>' +
                    '</div>' +
                    '<button onclick="addIncidentUpdate(' + incidentId + ')" style="background: #3b82f6; color: white; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer;">Add Update</button>' +
                '</div>';
            
            // Insert timeline before actions
            actionsDiv.insertAdjacentHTML('beforebegin', timelineHTML);
        }
        
        async function loadIncidentTimeline(incidentId) {
            try {
                const response = await fetch('/api/incident-updates?incident_id=' + incidentId, {
                    headers: getAuthHeaders()
                });
                const updates = await response.json();
                const container = document.getElementById('timeline-' + incidentId);
                
                if (!container) return; // Element might not exist yet
                
                if (updates.length === 0) {
                    container.innerHTML = '<p style=\"color: #6b7280; font-style: italic;\">No updates yet.</p>';
                    return;
                }
                
                container.innerHTML = updates.map(update => 
                    '<div style="padding: 0.75rem; margin-bottom: 0.5rem; border-left: 3px solid #3b82f6; background: #f8fafc; border-radius: 0 4px 4px 0;">' +
                        '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">' +
                            '<span style="font-weight: 600; text-transform: capitalize; color: #1e293b;">' + update.status + '</span>' +
                            '<span style="font-size: 0.875rem; color: #6b7280;">' + new Date(update.createdAt).toLocaleString() + '</span>' +
                        '</div>' +
                        '<p style="margin: 0; color: #374151;">' + update.message + '</p>' +
                        '<button onclick="deleteIncidentUpdate(' + update.id + ', ' + incidentId + ')" style="margin-top: 0.5rem; background: #dc2626; color: white; padding: 0.25rem 0.5rem; border: none; border-radius: 2px; font-size: 0.75rem; cursor: pointer;">Delete</button>' +
                    '</div>'
                ).join('');
            } catch (error) {
                console.error('Error loading incident timeline:', error);
            }
        }
        
        async function addIncidentUpdate(incidentId) {
            const status = document.getElementById('new-update-status-' + incidentId).value;
            const message = document.getElementById('new-update-message-' + incidentId).value;
            
            if (!message.trim()) {
                alert('Please enter a message for the update');
                return;
            }
            
            try {
                await fetch('/api/incident-updates', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        incidentId: incidentId,
                        status: status,
                        message: message.trim()
                    }),
                });
                
                // Clear the form
                document.getElementById('new-update-message-' + incidentId).value = '';
                
                // Reload the timeline
                loadIncidentTimeline(incidentId);
            } catch (error) {
                console.error('Error adding incident update:', error);
                alert('Failed to add update');
            }
        }
        
        async function deleteIncidentUpdate(updateId, incidentId) {
            if (confirm('Are you sure you want to delete this update?')) {
                try {
                    await fetch('/api/incident-updates?id=' + updateId, { 
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    loadIncidentTimeline(incidentId);
                } catch (error) {
                    console.error('Error deleting incident update:', error);
                }
            }
        }
        
        // Settings management
        async function loadSettings() {
            try {
                // Load page config
                const pageConfigResponse = await fetch('/api/page-config', {
                    headers: getAuthHeaders()
                });
                const pageConfig = await pageConfigResponse.json();
                document.getElementById('page-title').value = pageConfig.title;
                
                // Load system status
                const statusResponse = await fetch('/api/system-status', {
                    headers: getAuthHeaders()
                });
                const status = await statusResponse.json();
                document.getElementById('banner-message').value = status.bannerMessage;
                document.getElementById('overall-status').value = status.overallStatus;
                document.getElementById('current-banner').textContent = status.bannerMessage;
                document.getElementById('current-banner').style.background = 
                    status.overallStatus === 'operational' ? '#059669' : 
                    status.overallStatus === 'degraded' ? '#d97706' : '#dc2626';
                
                // Load auto banner setting
                const autoBannerEnabled = status.autoBanner ?? true;
                document.getElementById('auto-banner').checked = autoBannerEnabled;
                toggleBannerMode(); // Update UI based on auto banner status
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        }
        
        // SLO management
        async function loadSLOs() {
            try {
                // Load services for SLO dropdown
                const servicesResponse = await fetch('/api/services', {
                    headers: getAuthHeaders()
                });
                const services = await servicesResponse.json();
                const sloServiceSelect = document.getElementById('slo-service');
                sloServiceSelect.innerHTML = '<option value="">Select a service</option>' + 
                    services.map(service => '<option value="' + service.id + '">' + service.name + '</option>').join('');
                
                // Load SLOs
                const slosResponse = await fetch('/api/slos', {
                    headers: getAuthHeaders()
                });
                const slos = await slosResponse.json();
                const container = document.getElementById('slos');
                
                if (slos.length === 0) {
                    container.innerHTML = '<p>No SLOs configured. Create your first SLO to start monitoring service levels.</p>';
                    return;
                }
                
                container.innerHTML = slos.map(slo => {
                    const service = services.find(s => s.id === slo.serviceId);
                    const serviceName = service ? service.name : 'Unknown Service';
                    
                    return '<div class="item" id="slo-' + slo.id + '">' +
                        '<div class="slo-display" id="slo-display-' + slo.id + '">' +
                            '<h3>' + slo.name + '</h3>' +
                            '<p><strong>Service:</strong> ' + serviceName + '</p>' +
                            '<p><strong>Type:</strong> ' + slo.sliType.charAt(0).toUpperCase() + slo.sliType.slice(1) + '</p>' +
                            '<p><strong>Target:</strong> ' + slo.targetPercentage + '%</p>' +
                            (slo.latencyThresholdMs ? '<p><strong>Latency Threshold:</strong> ' + slo.latencyThresholdMs + 'ms</p>' : '') +
                            '<p><strong>Time Window:</strong> ' + slo.timeWindowDays + ' days</p>' +
                            '<p><strong>Status:</strong> ' + (slo.enabled ? 'Enabled' : 'Disabled') + '</p>' +
                            '<div class="item-actions">' +
                                '<button class="edit-btn" onclick="editSLO(' + slo.id + ')">Edit</button>' +
                                '<button onclick="viewSLOMetrics(' + slo.id + ')">View Metrics</button>' +
                                '<button onclick="deleteSLO(' + slo.id + ')">Delete</button>' +
                            '</div>' +
                        '</div>' +
                        '<div class="slo-edit" id="slo-edit-' + slo.id + '" style="display: none;">' +
                            '<div class="two-columns">' +
                                '<div class="form-group">' +
                                    '<label>SLO Name</label>' +
                                    '<input type="text" id="edit-slo-name-' + slo.id + '" value="' + slo.name + '" required>' +
                                '</div>' +
                                '<div class="form-group">' +
                                    '<label>Service</label>' +
                                    '<select id="edit-slo-service-' + slo.id + '" required>' +
                                        '<option value="">Select a service</option>' +
                                    '</select>' +
                                '</div>' +
                            '</div>' +
                            '<div class="two-columns">' +
                                '<div class="form-group">' +
                                    '<label>SLI Type</label>' +
                                    '<select id="edit-slo-sli-type-' + slo.id + '" onchange="toggleEditSLOFields(' + slo.id + ')">' +
                                        '<option value="availability"' + (slo.sliType === 'availability' ? ' selected' : '') + '>Availability</option>' +
                                        '<option value="latency"' + (slo.sliType === 'latency' ? ' selected' : '') + '>Latency</option>' +
                                    '</select>' +
                                '</div>' +
                                '<div class="form-group">' +
                                    '<label>Target Percentage</label>' +
                                    '<input type="number" id="edit-slo-target-' + slo.id + '" min="90" max="100" step="0.1" value="' + slo.targetPercentage + '" required>' +
                                '</div>' +
                            '</div>' +
                            '<div class="two-columns">' +
                                '<div class="form-group" id="edit-latency-threshold-group-' + slo.id + '" style="display: ' + (slo.sliType === 'latency' ? 'block' : 'none') + ';">' +
                                    '<label>Latency Threshold (ms)</label>' +
                                    '<input type="number" id="edit-slo-latency-threshold-' + slo.id + '" min="1" value="' + (slo.latencyThresholdMs || '') + '">' +
                                '</div>' +
                                '<div class="form-group">' +
                                    '<label>Time Window (days)</label>' +
                                    '<input type="number" id="edit-slo-time-window-' + slo.id + '" min="1" max="90" value="' + slo.timeWindowDays + '" required>' +
                                '</div>' +
                            '</div>' +
                            '<div class="form-group">' +
                                '<label>' +
                                    '<input type="checkbox" id="edit-slo-enabled-' + slo.id + '"' + (slo.enabled ? ' checked' : '') + '> Enabled' +
                                '</label>' +
                            '</div>' +
                            '<div class="item-actions">' +
                                '<button onclick="saveSLO(' + slo.id + ')">Save</button>' +
                                '<button class="cancel-btn" onclick="cancelEditSLO(' + slo.id + ')">Cancel</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
                }).join('');
                
                // Populate alert SLO dropdown
                const alertSloSelect = document.getElementById('alert-slo');
                alertSloSelect.innerHTML = '<option value="">Select an SLO</option>' + 
                    slos.map(slo => '<option value="' + slo.id + '">' + slo.name + '</option>').join('');
                
                // Populate service dropdowns in edit forms
                await populateSLOEditServiceDropdowns(slos, services);
                    
            } catch (error) {
                console.error('Error loading SLOs:', error);
            }
        }
        
        async function populateSLOEditServiceDropdowns(slos, services) {
            slos.forEach(slo => {
                const select = document.getElementById('edit-slo-service-' + slo.id);
                if (select) {
                    select.innerHTML = '<option value="">Select a service</option>' + 
                        services.map(service => 
                            '<option value="' + service.id + '" ' + (slo.serviceId === service.id ? 'selected' : '') + '>' + service.name + '</option>'
                        ).join('');
                }
            });
        }
        
        function editSLO(id) {
            document.getElementById('slo-display-' + id).style.display = 'none';
            document.getElementById('slo-edit-' + id).style.display = 'block';
            document.getElementById('slo-' + id).classList.add('editing');
        }
        
        function cancelEditSLO(id) {
            document.getElementById('slo-display-' + id).style.display = 'block';
            document.getElementById('slo-edit-' + id).style.display = 'none';
            document.getElementById('slo-' + id).classList.remove('editing');
        }
        
        function toggleEditSLOFields(sloId) {
            const sliType = document.getElementById('edit-slo-sli-type-' + sloId).value;
            const latencyGroup = document.getElementById('edit-latency-threshold-group-' + sloId);
            const latencyInput = document.getElementById('edit-slo-latency-threshold-' + sloId);
            
            if (sliType === 'latency') {
                latencyGroup.style.display = 'block';
                latencyInput.setAttribute('required', 'required');
            } else {
                latencyGroup.style.display = 'none';
                latencyInput.removeAttribute('required');
                latencyInput.value = '';
            }
        }
        
        async function saveSLO(id) {
            const sliType = document.getElementById('edit-slo-sli-type-' + id).value;
            
            const data = {
                name: document.getElementById('edit-slo-name-' + id).value,
                serviceId: parseInt(document.getElementById('edit-slo-service-' + id).value),
                sliType: sliType,
                targetPercentage: parseFloat(document.getElementById('edit-slo-target-' + id).value),
                timeWindowDays: parseInt(document.getElementById('edit-slo-time-window-' + id).value),
                enabled: document.getElementById('edit-slo-enabled-' + id).checked,
            };
            
            // Add latency threshold if it's a latency SLI
            if (sliType === 'latency') {
                const threshold = document.getElementById('edit-slo-latency-threshold-' + id).value;
                if (threshold) {
                    data.latencyThresholdMs = parseInt(threshold);
                }
            }
            
            try {
                const response = await fetch('/api/slos?id=' + id, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data),
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    alert('Error updating SLO: ' + (errorData.error || 'Unknown error'));
                    return;
                }
                
                cancelEditSLO(id);
                loadSLOs();
                alert('SLO updated successfully!');
            } catch (error) {
                console.error('Error updating SLO:', error);
                alert('Failed to update SLO. Please try again.');
            }
        }
        
        async function deleteSLO(id) {
            if (confirm('Are you sure? This will remove the SLO and all its alert rules.')) {
                try {
                    await fetch('/api/slos?id=' + id, { 
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    loadSLOs();
                    alert('SLO deleted successfully');
                } catch (error) {
                    console.error('Error deleting SLO:', error);
                    alert('Failed to delete SLO');
                }
            }
        }
        
        async function viewSLOMetrics(sloId) {
            try {
                const response = await fetch('/api/slo-metrics?slo_id=' + sloId, {
                    headers: getAuthHeaders()
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    alert('Failed to load SLO metrics: ' + (errorData.error || 'Unknown error'));
                    return;
                }
                
                const metrics = await response.json();
                
                const calc = metrics.calculation;
                const slo = metrics.slo;
                
                if (metrics.checksCount === 0) {
                    alert('SLO Metrics for "' + slo.name + '":\\n\\n' +
                        '⚠️ No data available yet\\n\\n' +
                        'This SLO needs status check data to calculate metrics.\\n' +
                        'Please ensure the associated service is enabled and has been\\n' +
                        'running checks for some time.\\n\\n' +
                        'Time Window: ' + metrics.timeWindow.days + ' days\\n' +
                        'SLI Type: ' + slo.sliType.charAt(0).toUpperCase() + slo.sliType.slice(1) + '\\n' +
                        'Target: ' + slo.targetPercentage + '%');
                    return;
                }
                
                alert('SLO Metrics for "' + slo.name + '":\\n\\n' +
                    'Current SLI: ' + calc.currentSLI.toFixed(2) + '%\\n' +
                    'Error Rate: ' + calc.errorRate.toFixed(2) + '%\\n' +
                    'Burn Rate: ' + calc.burnRate.toFixed(1) + 'x\\n' +
                    'Error Budget Consumed: ' + calc.errorBudgetConsumed.toFixed(1) + '%\\n' +
                    (calc.timeToExhaustion ? 'Time to Exhaustion: ' + calc.timeToExhaustion.toFixed(1) + ' hours\\n' : '') +
                    'Fast Burn: ' + (calc.isFastBurn ? 'YES ⚠️' : 'No') + '\\n\\n' +
                    'Checks Analysed: ' + metrics.checksCount + '\\n' +
                    'Time Window: ' + metrics.timeWindow.days + ' days');
                
            } catch (error) {
                console.error('Error loading SLO metrics:', error);
                alert('Failed to load SLO metrics: ' + error.message);
            }
        }
        
        // Notification management
        async function loadNotifications() {
            try {
                // Load notification channels
                const channelsResponse = await fetch('/api/notification-channels', {
                    headers: getAuthHeaders()
                });
                const channels = await channelsResponse.json();
                const container = document.getElementById('notification-channels');
                
                container.innerHTML = channels.map(channel => {
                    let config;
                    try {
                        config = JSON.parse(channel.config);
                    } catch (e) {
                        config = {};
                    }
                    
                    return '<div class="item">' +
                        '<h3>' + channel.name + '</h3>' +
                        '<p><strong>Type:</strong> ' + channel.type.toUpperCase() + '</p>' +
                        (config.url ? '<p><strong>URL:</strong> ' + config.url.substring(0, 50) + '...</p>' : '') +
                        (config.format ? '<p><strong>Format:</strong> ' + config.format + '</p>' : '') +
                        '<p><strong>Status:</strong> ' + (channel.enabled ? 'Enabled' : 'Disabled') + '</p>' +
                        '<div class="item-actions">' +
                            '<button class="edit-btn" onclick="testWebhook(' + channel.id + ')" ' + (!channel.enabled ? 'disabled' : '') + '>Test Webhook</button>' +
                            '<button onclick="deleteNotificationChannel(' + channel.id + ')">Delete</button>' +
                        '</div>' +
                    '</div>';
                }).join('');
                
                // Populate alert channel dropdown
                const alertChannelSelect = document.getElementById('alert-channel');
                alertChannelSelect.innerHTML = '<option value="">Select a channel</option>' + 
                    channels.map(channel => '<option value="' + channel.id + '">' + channel.name + '</option>').join('');
                
                // Load SLO notifications
                const notificationsResponse = await fetch('/api/slo-notifications', {
                    headers: getAuthHeaders()
                });
                const notifications = await notificationsResponse.json();
                
                // Load SLOs for notification display
                const slosResponse = await fetch('/api/slos', {
                    headers: getAuthHeaders()
                });
                const slos = await slosResponse.json();
                
                const notificationsContainer = document.getElementById('slo-notifications');
                notificationsContainer.innerHTML = notifications.map(notification => {
                    const slo = slos.find(s => s.id === notification.sloId);
                    const channel = channels.find(c => c.id === notification.notificationChannelId);
                    
                    return '<div class="item">' +
                        '<h3>Alert Rule</h3>' +
                        '<p><strong>SLO:</strong> ' + (slo ? slo.name : 'Unknown SLO') + '</p>' +
                        '<p><strong>Channel:</strong> ' + (channel ? channel.name : 'Unknown Channel') + '</p>' +
                        '<p><strong>Burn Rate Threshold:</strong> ' + notification.burnRateThreshold + 'x</p>' +
                        '<p><strong>Status:</strong> ' + (notification.enabled ? 'Enabled' : 'Disabled') + '</p>' +
                        '<div class="item-actions">' +
                            '<button onclick="deleteSLONotification(' + notification.id + ')">Delete</button>' +
                        '</div>' +
                    '</div>';
                }).join('');
                
            } catch (error) {
                console.error('Error loading notifications:', error);
            }
        }
        
        async function deleteNotificationChannel(id) {
            if (confirm('Are you sure? This will remove the channel and all its alert rules.')) {
                try {
                    await fetch('/api/notification-channels?id=' + id, { 
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    loadNotifications();
                    alert('Notification channel deleted successfully');
                } catch (error) {
                    console.error('Error deleting notification channel:', error);
                    alert('Failed to delete notification channel');
                }
            }
        }
        
        async function testWebhook(channelId) {
            if (!confirm('Send a test webhook to this channel?')) {
                return;
            }
            
            try {
                const response = await fetch('/api/test-webhook', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ channelId: channelId })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('✅ Test webhook sent successfully!\\n\\nCheck your Slack/Discord channel for the test message. If you don\\'t see it, verify your webhook URL and configuration.');
                } else {
                    alert('❌ Test webhook failed: ' + (result.message || result.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error testing webhook:', error);
                alert('❌ Failed to send test webhook. Please check your configuration and try again.');
            }
        }
        
        async function deleteSLONotification(id) {
            if (confirm('Are you sure you want to delete this alert rule?')) {
                try {
                    await fetch('/api/slo-notifications?id=' + id, { 
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    loadNotifications();
                    alert('Alert rule deleted successfully');
                } catch (error) {
                    console.error('Error deleting alert rule:', error);
                    alert('Failed to delete alert rule');
                }
            }
        }
        
        // Form handlers
        document.getElementById('category-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('category-name').value,
                description: document.getElementById('category-description').value,
                displayOrder: parseInt(document.getElementById('category-order').value),
            };
            
            try {
                await fetch('/api/categories', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data),
                });
                e.target.reset();
                loadCategories();
            } catch (error) {
                console.error('Error creating category:', error);
            }
        });
        
        document.getElementById('service-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const monitorType = document.getElementById('service-monitor-type').value;
            
            // Get URL and Method from monitor-specific fields
            let url, method;
            if (monitorType === 'http') {
                url = document.getElementById('service-url').value;
                method = document.getElementById('service-method').value;
            } else if (monitorType === 'keyword') {
                url = document.getElementById('service-url-keyword').value;
                method = document.getElementById('service-method-keyword').value;
            } else if (monitorType === 'api') {
                url = document.getElementById('service-url-api').value;
                method = document.getElementById('service-method-api').value;
            } else if (monitorType === 'database') {
                url = 'https://database.internal'; // Placeholder URL for PostgreSQL (not used)
                method = 'GET'; // Placeholder method for PostgreSQL (not used)
            }
            
            // Validate required fields
            if (!url && monitorType !== 'database') {
                alert('Please enter a URL for the service');
                return;
            }
            
            const data = {
                name: document.getElementById('service-name').value,
                url: url,
                categoryId: parseInt(document.getElementById('service-category').value),
                method: method,
                timeoutMs: parseInt(document.getElementById('service-timeout').value),
                monitorType: monitorType,
            };
            
            // Add monitor-specific fields based on type
            if (monitorType === 'http') {
                data.expectedStatus = parseInt(document.getElementById('service-expectedStatus').value);
                const expectedContent = document.getElementById('service-expectedContent').value;
                if (expectedContent) data.expectedContent = expectedContent;
            } else if (monitorType === 'keyword') {
                data.keyword = document.getElementById('service-keyword').value;
            } else if (monitorType === 'api') {
                const requestBody = document.getElementById('service-requestBody').value;
                const requestHeaders = document.getElementById('service-requestHeaders').value;
                const bearerToken = document.getElementById('service-bearerToken').value;
                
                if (requestBody) data.requestBody = requestBody;
                if (requestHeaders) data.requestHeaders = requestHeaders;
                if (bearerToken) data.bearerToken = bearerToken;
            } else if (monitorType === 'database') {
                const hyperdriveId = document.getElementById('service-hyperdriveId').value;
                const query = document.getElementById('service-databaseQuery').value;
                
                if (hyperdriveId) data.hyperdriveId = hyperdriveId;
                if (query) data.databaseQuery = query;
            }
            
            try {
                const response = await fetch('/api/services', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data),
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    alert('Error creating service: ' + (errorData.error || 'Unknown error'));
                    return;
                }
                
                e.target.reset();
                toggleMonitorFields(); // Reset form state
                loadServices();
                alert('Service created successfully!');
            } catch (error) {
                console.error('Error creating service:', error);
                alert('Failed to create service. Please try again.');
            }
        });
        
        document.getElementById('page-config-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                title: document.getElementById('page-title').value,
            };
            
            try {
                await fetch('/api/page-config', {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data),
                });
                alert('Page title updated successfully!');
            } catch (error) {
                console.error('Error updating page config:', error);
            }
        });
        
        document.getElementById('incident-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                title: document.getElementById('incident-title').value,
                description: document.getElementById('incident-description').value,
                status: document.getElementById('incident-status').value,
                severity: document.getElementById('incident-severity').value,
            };
            
            try {
                await fetch('/api/incidents', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data),
                });
                e.target.reset();
                loadIncidents();
            } catch (error) {
                console.error('Error creating incident:', error);
            }
        });
        
        document.getElementById('banner-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const autoBannerEnabled = document.getElementById('auto-banner').checked;
            
            const data = {
                autoBanner: autoBannerEnabled,
            };
            
            // Only include manual settings if auto banner is disabled
            if (!autoBannerEnabled) {
                data.manualBannerMessage = document.getElementById('banner-message').value;
                data.manualBannerStatus = document.getElementById('overall-status').value;
            }
            
            try {
                await fetch('/api/system-status', {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data),
                });
                loadSettings();
                alert('Banner settings updated successfully!');
            } catch (error) {
                console.error('Error updating banner:', error);
            }
        });
        
        // Service editing functions
        function editService(id) {
            document.getElementById('service-display-' + id).style.display = 'none';
            document.getElementById('service-edit-' + id).style.display = 'block';
            document.getElementById('service-' + id).classList.add('editing');
        }
        
        function cancelEditService(id) {
            document.getElementById('service-display-' + id).style.display = 'block';
            document.getElementById('service-edit-' + id).style.display = 'none';
            document.getElementById('service-' + id).classList.remove('editing');
        }
        
        async function saveService(id) {
            const monitorType = document.getElementById('edit-service-monitor-type-' + id).value;
            
            // Get URL and Method from monitor-specific fields
            let url, method;
            if (monitorType === 'http') {
                url = document.getElementById('edit-service-url-' + id).value;
                method = document.getElementById('edit-service-method-' + id).value;
            } else if (monitorType === 'keyword') {
                url = document.getElementById('edit-service-url-keyword-' + id).value;
                method = document.getElementById('edit-service-method-keyword-' + id).value;
            } else if (monitorType === 'api') {
                url = document.getElementById('edit-service-url-api-' + id).value;
                method = document.getElementById('edit-service-method-api-' + id).value;
            } else if (monitorType === 'database') {
                url = 'https://database.internal'; // Placeholder URL for PostgreSQL (not used)
                method = 'GET'; // Placeholder method for PostgreSQL (not used)
            }
            
            const data = {
                name: document.getElementById('edit-service-name-' + id).value,
                url: url,
                categoryId: parseInt(document.getElementById('edit-service-category-' + id).value) || null,
                method: method,
                timeoutMs: parseInt(document.getElementById('edit-service-timeout-' + id).value),
                enabled: document.getElementById('edit-service-enabled-' + id).checked,
                monitorType: monitorType,
            };
            
            // Add monitor-specific fields based on type
            if (monitorType === 'http') {
                data.expectedStatus = parseInt(document.getElementById('edit-service-expectedStatus-' + id).value);
                const expectedContent = document.getElementById('edit-service-expectedContent-' + id).value;
                if (expectedContent) data.expectedContent = expectedContent;
            } else if (monitorType === 'keyword') {
                data.keyword = document.getElementById('edit-service-keyword-' + id).value;
            } else if (monitorType === 'api') {
                const requestBody = document.getElementById('edit-service-requestBody-' + id).value;
                const requestHeaders = document.getElementById('edit-service-requestHeaders-' + id).value;
                const bearerToken = document.getElementById('edit-service-bearerToken-' + id).value;
                
                if (requestBody) data.requestBody = requestBody;
                if (requestHeaders) data.requestHeaders = requestHeaders;
                if (bearerToken) data.bearerToken = bearerToken;
            } else if (monitorType === 'database') {
                const hyperdriveId = document.getElementById('edit-service-hyperdriveId-' + id).value;
                const query = document.getElementById('edit-service-databaseQuery-' + id).value;
                
                if (hyperdriveId) data.hyperdriveId = hyperdriveId;
                if (query) data.databaseQuery = query;
            }
            
            try {
                await fetch('/api/services?id=' + id, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data),
                });
                cancelEditService(id);
                loadServices();
            } catch (error) {
                console.error('Error updating service:', error);
                alert('Failed to update service');
            }
        }
        
        async function populateServiceEditCategoryDropdowns(services) {
            try {
                const response = await fetch('/api/categories', {
                    headers: getAuthHeaders()
                });
                const categories = await response.json();
                
                services.forEach(service => {
                    const select = document.getElementById('edit-service-category-' + service.id);
                    if (select) {
                        select.innerHTML = '<option value="">Select a category</option>' + 
                            categories.map(cat => 
                                '<option value="' + cat.id + '" ' + (service.categoryId === cat.id ? 'selected' : '') + '>' + cat.name + '</option>'
                            ).join('');
                    }
                });
            } catch (error) {
                console.error('Error loading categories for edit forms:', error);
            }
        }
        
        // SLO form handlers
        document.getElementById('slo-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const sliType = document.getElementById('slo-sli-type').value;
            
            const data = {
                serviceId: parseInt(document.getElementById('slo-service').value),
                name: document.getElementById('slo-name').value,
                sliType: sliType,
                targetPercentage: parseFloat(document.getElementById('slo-target').value),
                timeWindowDays: parseInt(document.getElementById('slo-time-window').value),
                enabled: document.getElementById('slo-enabled').checked,
            };
            
            // Add latency threshold if it's a latency SLI
            if (sliType === 'latency') {
                const threshold = document.getElementById('slo-latency-threshold').value;
                if (threshold) {
                    data.latencyThresholdMs = parseInt(threshold);
                }
            }
            
            try {
                const response = await fetch('/api/slos', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data),
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    alert('Error creating SLO: ' + (errorData.error || 'Unknown error'));
                    return;
                }
                
                e.target.reset();
                toggleSLOFields(); // Reset form state
                loadSLOs();
                alert('SLO created successfully!');
            } catch (error) {
                console.error('Error creating SLO:', error);
                alert('Failed to create SLO. Please try again.');
            }
        });
        
        document.getElementById('notification-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const type = document.getElementById('notification-type').value;
            
            if (type !== 'webhook') {
                alert('Only webhook notifications are currently supported');
                return;
            }
            
            const webhookUrl = document.getElementById('webhook-url').value;
            const format = document.getElementById('webhook-format').value;
            const headers = document.getElementById('webhook-headers').value;
            
            // Build config object
            const config = {
                url: webhookUrl,
                format: format,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            // Add custom headers if provided
            if (headers.trim()) {
                try {
                    const customHeaders = JSON.parse(headers);
                    Object.assign(config.headers, customHeaders);
                } catch (error) {
                    alert('Invalid JSON in custom headers');
                    return;
                }
            }
            
            const data = {
                name: document.getElementById('notification-name').value,
                type: type,
                config: JSON.stringify(config),
                enabled: document.getElementById('notification-enabled').checked,
            };
            
            try {
                const response = await fetch('/api/notification-channels', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data),
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    alert('Error creating notification channel: ' + (errorData.error || 'Unknown error'));
                    return;
                }
                
                e.target.reset();
                toggleNotificationFields(); // Reset form state
                loadNotifications();
                alert('Notification channel created successfully!');
            } catch (error) {
                console.error('Error creating notification channel:', error);
                alert('Failed to create notification channel. Please try again.');
            }
        });
        
        document.getElementById('slo-notification-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const data = {
                sloId: parseInt(document.getElementById('alert-slo').value),
                notificationChannelId: parseInt(document.getElementById('alert-channel').value),
                burnRateThreshold: parseFloat(document.getElementById('alert-threshold').value),
                enabled: document.getElementById('alert-enabled').checked,
            };
            
            try {
                const response = await fetch('/api/slo-notifications', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data),
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    alert('Error creating alert rule: ' + (errorData.error || 'Unknown error'));
                    return;
                }
                
                e.target.reset();
                loadNotifications();
                alert('Alert rule created successfully!');
            } catch (error) {
                console.error('Error creating alert rule:', error);
                alert('Failed to create alert rule. Please try again.');
            }
        });
        
        // Initialize
        loadCategories();
        toggleMonitorFields(); // Set initial form state
        toggleSLOFields(); // Set initial SLO form state
        toggleNotificationFields(); // Set initial notification form state
    </script>
</body>
</html>`;

		return new Response(adminHtml, {
			headers: { 'Content-Type': 'text/html' },
		});
	}
}
