import { PageGeneratorService, StatusPageData, ServiceStatusData } from '../../domain/services/PageGeneratorService';

export class HtmlPageGeneratorService implements PageGeneratorService {
	generateStatusPage(data: StatusPageData): string {
		return `<!DOCTYPE html>
<html lang="en-AU">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #f8fafc; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .header { text-align: center; margin-bottom: 3rem; }
        .header h1 { font-size: 2.5rem; color: #1e293b; margin-bottom: 0.5rem; }
        .header p { color: #64748b; font-size: 1.1rem; }
        .service { background: white; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .service-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 2rem; }
        .service-name { font-size: 1.25rem; font-weight: 600; color: #1e293b; }
        .status-badge { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem; font-weight: 500; }
        .status-up { background: #dcfce7; color: #166534; }
        .status-down { background: #fecaca; color: #991b1b; }
        .status-degraded { background: #fef3c7; color: #92400e; }
        .metrics { display: flex; gap: 2rem; margin-bottom: 1rem; color: #64748b; }
        .metric { font-size: 0.875rem; }
        .history { display: flex; gap: 1px; height: 40px; align-items: end; overflow-x: auto; flex: 1; min-width: 0; }
        .history-bar { width: 3px; border-radius: 1px; flex-shrink: 0; min-width: 2px; }
        .footer { text-align: center; margin-top: 3rem; color: #64748b; font-size: 0.875rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${data.title}</h1>
            <p>${data.description}</p>
        </div>
        
        ${data.categories
					.flatMap((category) => category.services)
					.map((service) => this.generateServiceCard(service))
					.join('')}
        
        <div class="footer">
            <p>Last updated: ${data.lastUpdated.toLocaleString('en-AU')}</p>
        </div>
    </div>
</body>
</html>`;
	}

	private generateServiceCard(service: ServiceStatusData): string {
		const statusClass = `status-${service.status}`;
		// Calculate height based on response time for proper graph visualization
		const maxResponseTime = Math.max(...service.history.filter((p) => p.responseTime).map((p) => p.responseTime!), 1000);
		const historyBars = service.history
			.map((point) => {
				let height: number;
				let tooltipText: string;

				if (point.status === 'down') {
					height = 8; // Minimal height for down status
					tooltipText = `${point.status.toUpperCase()} at ${point.timestamp.toLocaleString('en-AU')}`;
				} else if (point.responseTime) {
					// Scale response time to 15-40px range
					height = Math.max(15, Math.min(40, (point.responseTime / maxResponseTime) * 40));
					tooltipText = `${point.status.toUpperCase()}: ${point.responseTime}ms at ${point.timestamp.toLocaleString('en-AU')}`;
				} else {
					height = 20; // Default height when no response time data
					tooltipText = `${point.status.toUpperCase()} at ${point.timestamp.toLocaleString('en-AU')}`;
				}

				const color = this.getStatusColor(point.status);
				return `<div class="history-bar" style="height: ${height}px; background: ${color};" title="${tooltipText}"></div>`;
			})
			.join('');

		return `
        <div class="service">
            <div class="service-header">
                <div class="service-name">${service.name}</div>
                <div class="status-badge ${statusClass}">${service.status.toUpperCase()}</div>
            </div>
            <div class="metrics">
                <div class="metric">Uptime: ${service.uptime.toFixed(2)}%</div>
                ${service.responseTime ? `<div class="metric">Response Time: ${service.responseTime}ms</div>` : ''}
            </div>
            <div class="history">
                ${historyBars}
            </div>
        </div>`;
	}

	private getStatusColor(status: string): string {
		switch (status) {
			case 'up':
				return '#22c55e';
			case 'down':
				return '#ef4444';
			case 'degraded':
				return '#f59e0b';
			default:
				return '#64748b';
		}
	}
}
