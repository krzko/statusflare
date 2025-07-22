import {
	PageGeneratorService,
	StatusPageData,
	CategoryStatusData,
	ServiceStatusData,
	IncidentData,
} from '../../domain/services/PageGeneratorService';

export class StatusPageHtmlGenerator implements PageGeneratorService {
	generateStatusPage(data: StatusPageData): string {
		return `<!DOCTYPE html>
<html lang="en-AU">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.generatePageTitle(data)}</title>
    ${this.generateFavicon(data.overallStatus)}
    <link rel="alternate" type="application/rss+xml" title="${data.title} - Incident Updates" href="/rss">
    <link rel="alternate" type="application/feed+json" title="${data.title} - Incident Updates" href="/feed.json">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #f8fafc; color: #334155; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        
        /* Status Banner */
        .status-banner { 
            background: ${this.getBannerColor(data.overallStatus)}; 
            color: white; 
            padding: 1rem 2rem; 
            border-radius: 8px; 
            margin-bottom: 2rem; 
            font-size: 1.125rem; 
            font-weight: 600; 
        }
        
        /* Header */
        .header { text-align: center; margin-bottom: 2rem; }
        .header h1 { font-size: 2.5rem; color: #1e293b; margin-bottom: 0.5rem; }
        
        /* General Availability */
        .general-availability {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .general-availability h2 { font-size: 1.25rem; color: #1e293b; font-weight: 600; }
        .status-label { font-weight: 500; color: ${this.getStatusColor(data.overallStatus)}; }
        
        /* Categories */
        .category {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin-bottom: 1rem;
            overflow: hidden;
        }
        
        .category-header {
            padding: 1rem 1.5rem;
            display: grid;
            grid-template-columns: 1fr 2fr 1fr;
            gap: 1rem;
            align-items: center;
            cursor: pointer;
            border-bottom: 1px solid #e2e8f0;
        }
        .category-header:hover { background: #f8fafc; }
        
        .category-title {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 1.125rem;
            font-weight: 600;
            color: #1e293b;
        }
        
        .expand-icon { 
            width: 16px; 
            height: 16px; 
            transition: transform 0.2s;
            color: #64748b;
        }
        .category.expanded .expand-icon { transform: rotate(90deg); }
        
        .category-status { 
            display: flex; 
            align-items: center; 
            gap: 1rem; 
        }
        
        .service-status {
            display: flex; 
            align-items: center; 
            gap: 1rem; 
        }
        
        /* History Graph */
        .history-container {
            display: flex;
            align-items: center;
            gap: 1rem;
            min-width: 400px;
        }
        .history-timeline { 
            display: flex; 
            gap: 1px; 
            height: 30px; 
            align-items: end; 
            flex: 1;
        }
        .history-bar { 
            width: 4px; 
            height: 30px; 
            border-radius: 1px; 
            flex-shrink: 0;
        }
        .history-labels { 
            display: flex; 
            justify-content: space-between; 
            font-size: 0.75rem; 
            color: #64748b; 
            min-width: 200px;
        }
        
        /* Services */
        .category-content {
            display: none;
            padding: 0;
        }
        .category.expanded .category-content { display: block; }
        
        .service {
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #f1f5f9;
            display: grid;
            grid-template-columns: 1fr 2fr 1fr;
            gap: 1rem;
            align-items: center;
        }
        .service:last-child { border-bottom: none; }
        
        .service-name { 
            font-weight: 500; 
            color: #1e293b; 
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            padding-left: 2rem;
        }
        
        .uptime-percent { 
            font-size: 0.875rem; 
            color: #64748b; 
            min-width: 80px; 
            text-align: center;
        }
        
        .metric-small { 
            font-size: 0.75rem; 
            color: #64748b; 
        }
        
        /* Incidents */
        .incidents-section { margin-top: 3rem; }
        .incidents-title { 
            font-size: 1.5rem; 
            color: #1e293b; 
            margin-bottom: 1.5rem; 
            font-weight: 600; 
        }
        
        .incident-day {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin-bottom: 1rem;
            overflow: hidden;
        }
        
        .incident-date {
            padding: 1rem 1.5rem;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            font-weight: 600;
            color: #1e293b;
        }
        
        .incident {
            padding: 1.5rem;
            border-bottom: 1px solid #f1f5f9;
        }
        .incident:last-child { border-bottom: none; }
        
        .incident-title { 
            font-size: 1.125rem; 
            font-weight: 600; 
            color: #1e293b; 
            margin-bottom: 0.5rem; 
        }
        
        .incident-status { 
            display: inline-block; 
            font-size: 0.875rem; 
            font-weight: 500; 
            margin-bottom: 1rem;
        }
        
        .incident-update {
            margin: 0.75rem 0;
            padding: 1rem 1.25rem;
            border-radius: 6px;
            border-left: 4px solid #e2e8f0;
            background: #f8fafc;
            position: relative;
        }
        
        /* Status-specific styling */
        .incident-update.initial-update { 
            border-left-color: #cc0000; 
            background: #fef2f2;
        }
        .incident-update.subsequent-update { 
            border-left-color: #3d85c6; 
            background: #eff6ff;
        }
        .incident-update.resolved-update { 
            border-left-color: #27b376; 
            background: #f0fdf4;
        }
        
        .incident-update:first-child { margin-top: 0; }
        .incident-update:last-child { margin-bottom: 0; }
        
        .update-header {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 0.75rem;
            font-size: 0.875rem;
        }
        
        .update-status { 
            font-weight: 600; 
            color: #1e293b; 
        }
        .update-message {
            color: #374151; 
            line-height: 1.6;
            font-size: 0.9rem;
        }
        .update-time { color: #64748b; }
        
        .no-incidents { 
            color: #64748b; 
            text-align: center; 
            padding: 2rem; 
        }
        
        /* Footer */
        .footer { 
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 3rem; 
            color: #64748b; 
            font-size: 0.875rem; 
        }
        
        .footer-left {
            flex: 1;
        }
        
        .footer-right {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .rss-link {
            color: #64748b;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 0.25rem;
            font-size: 0.875rem;
            transition: color 0.2s;
        }
        
        .rss-link:hover {
            color: #f59e0b;
        }
        
        .rss-icon {
            width: 16px;
            height: 16px;
            fill: currentColor;
        }
        
        /* Status Colors - Standardised Palette */
        .status-operational { color: #27b376; }
        .status-degraded { color: #e69138; }
        .status-major_outage { color: #cc0000; }
        .status-down { color: #cc0000; }
        .status-up { color: #27b376; }
        
        /* Status Badges */
        .status-badges {
            display: flex;
            gap: 0.25rem;
            margin-left: 0.5rem;
        }
        
        .status-badge {
            padding: 0.125rem 0.375rem;
            border-radius: 0.375rem;
            font-size: 0.75rem;
            font-weight: 600;
            color: white;
            min-width: 20px;
            text-align: center;
        }
        
        .status-badge.operational {
            background-color: #27b376;
        }
        
        .status-badge.degraded {
            background-color: #e69138;
        }
        
        .status-badge.down {
            background-color: #cc0000;
        }
        
        /* Responsive Design - Mobile Layout */
        @media (max-width: 768px) {
            .container { padding: 1rem; }
            
            /* Category layout for mobile - convert grid to single column */
            .category-header {
                grid-template-columns: 1fr !important;
                gap: 1rem !important;
                align-items: flex-start !important;
            }
            
            .category-header .history-container {
                order: 2;
                width: 100% !important;
                min-width: auto !important;
            }
            
            .category-header > div:last-child {
                order: 3;
                width: 100% !important;
                justify-content: flex-start !important;
                flex-wrap: wrap;
                gap: 0.5rem !important;
            }
            
            /* Service layout for mobile - convert grid to single column */
            .service {
                grid-template-columns: 1fr !important;
                gap: 1rem !important;
                align-items: flex-start !important;
                padding: 1rem !important;
            }
            
            .service-name {
                order: 1;
                width: 100% !important;
                padding-left: 0 !important;
                margin-bottom: 0.5rem;
            }
            
            .service .history-container {
                order: 2;
                width: 100% !important;
                min-width: auto !important;
            }
            
            .service > div:last-child {
                order: 3;
                width: 100% !important;
                justify-content: flex-start !important;
                flex-wrap: wrap;
                gap: 0.5rem !important;
            }
            
            /* Timeline bars for mobile - show fewer bars to fit screen */
            .history-timeline {
                min-width: auto !important;
                width: 100% !important;
            }
            
            /* Enable horizontal scrolling for timeline bars on mobile */
            .history-timeline {
                overflow-x: auto;
                scroll-behavior: smooth;
                scrollbar-width: thin;
            }
            
            /* Webkit scrollbar styling for mobile timeline */
            .history-timeline::-webkit-scrollbar {
                height: 4px;
            }
            
            .history-timeline::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 2px;
            }
            
            .history-timeline::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 2px;
            }
            
            /* Adjust font sizes for mobile */
            .header h1 { font-size: 2rem; }
            .category-name h3 { font-size: 1.25rem; }
            .service .service-name { font-size: 1rem; }
            
            /* Adjust history bars for mobile */
            .history-timeline {
                min-width: auto !important;
                width: 100% !important;
            }
            
            .history-labels {
                min-width: auto !important;
                width: 100% !important;
            }
        }
        
        @media (max-width: 480px) {
            .container { padding: 0.5rem; }
            .header h1 { font-size: 1.75rem; }
            .status-banner { padding: 0.75rem 1rem; font-size: 1rem; }
            
            /* Stack metrics vertically on very small screens - target only the metrics container */
            .service > div:last-child > div,
            .category-header > div:last-child {
                flex-direction: column !important;
                align-items: flex-start !important;
                gap: 0.25rem !important;
            }
            
            /* Footer responsive */
            .footer {
                flex-direction: column !important;
                align-items: center !important;
                gap: 1rem !important;
                text-align: center !important;
            }
            
            .footer-left,
            .footer-right {
                flex: none !important;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${data.title}</h1>
        </div>
        
        <div class="status-banner">
            ${data.bannerMessage}
        </div>
        
        ${data.categories.map(category => this.generateCategoryCard(category)).join('')}
        
        <div class="incidents-section">
            <h2 class="incidents-title">Past Incidents</h2>
            ${this.generateIncidents(data.incidents)}
        </div>
        
        <div class="footer">
            <div class="footer-left">
                <p>Last updated: ${data.lastUpdated.toLocaleString('en-AU', { timeZone: 'UTC' })}</p>
            </div>
            <div class="footer-right">
                <a href="/rss" class="rss-link" title="Subscribe to incident updates via RSS">
                    <svg class="rss-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 11a9 9 0 0 1 9 9"></path>
                        <path d="M4 4a16 16 0 0 1 16 16"></path>
                        <circle cx="5" cy="19" r="1"></circle>
                    </svg>
                    RSS
                </a>
            </div>
        </div>
    </div>
    
    <script>
        // Toggle category expansion
        document.querySelectorAll('.category-header').forEach(header => {
            header.addEventListener('click', () => {
                const category = header.closest('.category');
                category.classList.toggle('expanded');
            });
        });
    </script>
</body>
</html>`;
	}

	private generateCategoryCard(category: CategoryStatusData): string {
		const historyBars = this.generateCategoryHistoryBars(category);

		const servicesList = category.services
			.map(service => {
				// Generate service history bars based on latency or use placeholders
				const serviceHistoryBars = this.generateServiceHistoryBars(service);

				// Calculate average response time for display
				const avgResponseTime =
					service.responseTime || this.calculateAverageResponseTime(service.history);
				const latencyDisplay = avgResponseTime ? `${Math.round(avgResponseTime)}ms` : 'N/A';

				return `
			<div class="service">
				<span class="service-name">${service.name}</span>
				<div class="history-container">
					<div class="history-timeline">
						${serviceHistoryBars}
					</div>
				</div>
				<div style="display: flex; align-items: center; gap: 1rem; justify-content: flex-end;">
					<span class="metric-small">${latencyDisplay}</span>
					<span class="metric-small">${service.uptime.toFixed(2)}% uptime</span>
					<span class="status-label status-${service.status}">${this.formatStatus(service.status)}</span>
				</div>
			</div>`;
			})
			.join('');

		// Calculate service status counts for badges
		const statusCounts = this.calculateServiceStatusCounts(category.services);

		return `
		<div class="category">
			<div class="category-header">
				<div class="category-title">
					<svg class="expand-icon" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>
					</svg>
					${category.name}
					<div class="status-badges">
						${statusCounts.operational > 0 ? `<span class="status-badge operational">${statusCounts.operational}</span>` : ''}
						${statusCounts.degraded > 0 ? `<span class="status-badge degraded">${statusCounts.degraded}</span>` : ''}
						${statusCounts.down > 0 ? `<span class="status-badge down">${statusCounts.down}</span>` : ''}
					</div>
				</div>
				<div class="history-container">
					<div class="history-timeline">
						${historyBars}
					</div>
				</div>
				<div style="display: flex; align-items: center; gap: 1rem; justify-content: flex-end;">
					<span class="metric-small">24h ago</span>
					<span class="metric-small">${category.uptime.toFixed(2)}% uptime</span>
					<span class="status-label status-${category.status}">${this.formatStatus(category.status)}</span>
				</div>
			</div>
			<div class="category-content">
				${servicesList}
			</div>
		</div>`;
	}

	private generateIncidents(incidents: IncidentData[]): string {
		// Group incidents by date
		const incidentsByDate: { [key: string]: IncidentData[] } = {};
		incidents.forEach(incident => {
			const dateKey = this.formatDateOnly(incident.startedAt);
			if (!incidentsByDate[dateKey]) {
				incidentsByDate[dateKey] = [];
			}
			incidentsByDate[dateKey].push(incident);
		});

		// Always show today's date
		const today = this.formatDateOnly(new Date());
		if (!incidentsByDate[today]) {
			incidentsByDate[today] = [];
		}

		return Object.entries(incidentsByDate)
			.sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime()) // Sort by date, newest first
			.map(
				([date, dayIncidents]) => `
		<div class="incident-day">
			<div class="incident-date">${date}</div>
			${
				dayIncidents.length === 0
					? '<div class="no-incidents">No incidents reported today.</div>'
					: dayIncidents.map(incident => this.generateIncident(incident)).join('')
			}
		</div>`
			)
			.join('');
	}

	private generateIncident(incident: IncidentData): string {
		// Just show the incident title at the top
		const incidentTitle = `<div class="incident-title">${incident.title}</div>`;

		// Don't show incident description separately - it will appear in the timeline

		// Always create initial incident entry with consistent formatting
		const initialUpdate = `
			<div class="incident-update initial-update">
				<div class="update-header">
					<span class="update-status">${this.formatStatus(incident.status)}</span>
					<span>-</span>
					<span class="update-time">${incident.startedAt.toLocaleString('en-AU', { timeZone: 'UTC' })}</span>
				</div>
				<div class="update-message">${incident.description || 'Incident reported'}</div>
			</div>`;

		// Format additional incident updates/timeline (if any)
		const additionalUpdates =
			incident.updates.length > 0
				? incident.updates
						.map(update => {
							const updateClass =
								update.status === 'resolved' ? 'resolved-update' : 'subsequent-update';
							return `
			<div class="incident-update ${updateClass}">
				<div class="update-header">
					<span class="update-status">${this.formatStatus(update.status)}</span>
					<span>-</span>
					<span class="update-time">${update.createdAt.toLocaleString('en-AU', { timeZone: 'UTC' })}</span>
				</div>
				<div class="update-message">${update.message}</div>
			</div>`;
						})
						.join('')
				: '';

		// Show resolved time if incident is resolved
		const resolvedTime = incident.resolvedAt
			? `<div style="font-size: 0.875rem; color: #059669; margin-top: 1rem; font-weight: 500;">
				✓ Resolved: ${incident.resolvedAt.toLocaleString('en-AU')}
			</div>`
			: '';

		return `
		<div class="incident">
			${incidentTitle}
			${initialUpdate}
			${additionalUpdates}
			${resolvedTime}
		</div>`;
	}

	private generateCategoryHistoryBars(category: CategoryStatusData): string {
		const maxBars = 90; // Maximum number of bars to display
		const history = category.history || [];

		// If no history data, create grey placeholder bars
		if (history.length === 0) {
			return Array(maxBars)
				.fill(0)
				.map(
					() =>
						`<div class="history-bar" style="background: #e2e8f0;" title="No data available"></div>`
				)
				.join('');
		}

		// Pad with grey bars if we have less than maxBars
		const paddedHistory = [...history];
		while (paddedHistory.length < maxBars) {
			paddedHistory.unshift({
				timestamp: new Date(),
				status: 'unknown',
			});
		}

		// Take only the last maxBars entries
		const displayHistory = paddedHistory.slice(-maxBars);

		return displayHistory
			.map(point => {
				if (point.status === 'unknown') {
					// Grey placeholder for missing data
					return `<div class="history-bar" style="background: #e2e8f0;" title="No data available"></div>`;
				}

				const color = this.getHistoryBarColor(point.status);
				return `<div class="history-bar" style="background: ${color};" title="${point.status} on ${point.timestamp.toLocaleDateString('en-AU')}"></div>`;
			})
			.join('');
	}

	private generateServiceHistoryBars(service: ServiceStatusData): string {
		const maxBars = 90; // Maximum number of bars to display
		const history = service.history || [];

		// If no history data, create grey placeholder bars
		if (history.length === 0) {
			return Array(maxBars)
				.fill(0)
				.map(
					() =>
						`<div class="history-bar" style="background: #e2e8f0; height: 15px;" title="No data available"></div>`
				)
				.join('');
		}

		// Find min/max response times for scaling
		const responseTimes = history
			.filter(point => point.responseTime !== undefined)
			.map(point => point.responseTime!);
		const minResponseTime = Math.min(...responseTimes, 0);
		const maxResponseTime = Math.max(...responseTimes, 1000);

		// Pad with grey bars if we have less than maxBars
		const paddedHistory = [...history];
		while (paddedHistory.length < maxBars) {
			paddedHistory.unshift({
				timestamp: new Date(),
				status: 'unknown',
				responseTime: undefined,
			});
		}

		// Take only the last maxBars entries
		const displayHistory = paddedHistory.slice(-maxBars);

		return displayHistory
			.map(point => {
				if (!point.responseTime) {
					// Grey placeholder for missing data
					return `<div class="history-bar" style="background: #e2e8f0; height: 15px;" title="No data available"></div>`;
				}

				// Calculate height based on response time (inverted - faster = taller)
				const normalizedHeight =
					1 - (point.responseTime - minResponseTime) / (maxResponseTime - minResponseTime);
				const height = Math.max(5, Math.min(30, 5 + normalizedHeight * 25)); // 5px to 30px range

				// Color based on status
				const color = this.getHistoryBarColor(point.status);

				// Enhanced tooltip with better datetime formatting
				const dateTime = point.timestamp.toLocaleString('en-AU', {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
				});
				const title = `${this.formatStatus(point.status)} - ${point.responseTime}ms\n${dateTime}`;

				return `<div class="history-bar" style="background: ${color}; height: ${height}px;" title="${title}"></div>`;
			})
			.join('');
	}

	private calculateAverageResponseTime(history: any[]): number | undefined {
		if (!history || history.length === 0) {
			return undefined;
		}

		const responseTimes = history
			.filter(point => point.responseTime && point.responseTime > 0)
			.map(point => point.responseTime);

		if (responseTimes.length === 0) {
			return undefined;
		}

		return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
	}

	private getBannerColor(status: string): string {
		switch (status) {
			case 'operational':
				return '#27b376';
			case 'degraded':
				return '#e69138';
			case 'major_outage':
				return '#cc0000';
			default:
				return '#27b376';
		}
	}

	private getStatusColor(status: string): string {
		switch (status) {
			case 'operational':
			case 'up':
				return '#27b376';
			case 'degraded':
				return '#e69138';
			case 'major_outage':
			case 'down':
				return '#cc0000';
			default:
				return '#64748b';
		}
	}

	private getHistoryBarColor(status: string): string {
		switch (status) {
			case 'up':
			case 'operational':
				return '#27b376';
			case 'down':
			case 'major_outage':
				return '#cc0000';
			case 'degraded':
				return '#e69138';
			default:
				return '#d1d5db'; // Grey for no data
		}
	}

	private formatStatus(status: string): string {
		switch (status) {
			case 'operational':
				return 'Operational';
			case 'degraded':
				return 'Degraded';
			case 'major_outage':
				return 'Outage';
			case 'up':
				return 'Operational';
			case 'down':
				return 'Down';
			case 'identified':
				return 'Identified';
			case 'investigating':
				return 'Investigating';
			case 'update':
				return 'Update';
			case 'resolved':
				return 'Resolved';
			default:
				return status.charAt(0).toUpperCase() + status.slice(1);
		}
	}

	private formatDateOnly(date: Date): string {
		return date.toLocaleDateString('en-AU', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC', // Consistent UTC timezone
		});
	}

	private generatePageTitle(data: StatusPageData): string {
		const statusText = this.getOverallStatusText(data.overallStatus);
		return `${statusText} | ${data.title}`;
	}

	private getOverallStatusText(status: string): string {
		switch (status) {
			case 'operational':
				return 'All Systems Operational';
			case 'degraded':
				return 'Degraded Operations';
			case 'major_outage':
				return 'Outage';
			default:
				return 'System Status';
		}
	}

	private generateFavicon(status: string): string {
		const faviconColor = this.getFaviconColor(status);
		// Generate a simple SVG circle favicon with proper URL encoding
		const svgFavicon = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='${faviconColor}'/%3E%3C/svg%3E`;
		return `<link rel="icon" type="image/svg+xml" href="${svgFavicon}">`;
	}

	private getFaviconColor(status: string): string {
		switch (status) {
			case 'operational':
				return '%2327b376'; // Green (URL encoded)
			case 'degraded':
				return '%23e69138'; // Orange (URL encoded)
			case 'major_outage':
				return '%23cc0000'; // Red (URL encoded)
			default:
				return '%23d1d5db'; // Grey (URL encoded)
		}
	}

	private calculateServiceStatusCounts(services: ServiceStatusData[]): {
		operational: number;
		degraded: number;
		down: number;
	} {
		return services.reduce(
			(counts, service) => {
				switch (service.status) {
					case 'operational':
					case 'up':
						counts.operational++;
						break;
					case 'degraded':
						counts.degraded++;
						break;
					case 'major_outage':
					case 'down':
						counts.down++;
						break;
				}
				return counts;
			},
			{ operational: 0, degraded: 0, down: 0 }
		);
	}
}
