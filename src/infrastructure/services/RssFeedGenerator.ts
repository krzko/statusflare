import { IncidentData } from '../../domain/services/PageGeneratorService';

export interface RssFeedData {
	title: string;
	description: string;
	link: string;
	incidents: IncidentData[];
	lastUpdated: Date;
	titleSuffix?: string;
}

export class RssFeedGenerator {
	generateRssFeed(data: RssFeedData): string {
		const rssItems = data.incidents
			.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
			.slice(0, 50) // Limit to 50 most recent incidents
			.map((incident) => this.generateRssItem(incident, data.link))
			.join('\n');

		const feedTitle = data.titleSuffix ? `${data.title} - ${data.titleSuffix}` : `${data.title} - Incident Updates`;

		return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
	<channel>
		<title><![CDATA[${feedTitle}]]></title>
		<description><![CDATA[Latest incident updates and status changes for ${data.title}]]></description>
		<link>${data.link}</link>
		<atom:link href="${data.link}/rss" rel="self" type="application/rss+xml" />
		<language>en-AU</language>
		<lastBuildDate>${this.formatRssDate(data.lastUpdated)}</lastBuildDate>
		<pubDate>${this.formatRssDate(data.lastUpdated)}</pubDate>
		<ttl>15</ttl>
		<generator>Statusflare - Cloudflare Workers</generator>
		<webMaster>noreply@status.local (Statusflare)</webMaster>
		<managingEditor>noreply@status.local (Statusflare)</managingEditor>
		<category>Technology</category>
		<category>Status Updates</category>
		<image>
			<url>${data.link}/favicon.ico</url>
			<title>${data.title} Status</title>
			<link>${data.link}</link>
			<width>32</width>
			<height>32</height>
		</image>
${rssItems}
	</channel>
</rss>`;
	}

	private generateRssItem(incident: IncidentData, baseUrl: string): string {
		const guid = `${baseUrl}/incidents/${incident.id}`;
		const status = this.getIncidentStatusText(incident.status);
		const description = this.generateItemDescription(incident);
		const categories = this.getIncidentCategories(incident);

		// Use the most recent update time, or incident start time if no updates
		const latestUpdate =
			incident.updates && incident.updates.length > 0 ? incident.updates[incident.updates.length - 1].createdAt : incident.startedAt;

		return `		<item>
			<title><![CDATA[${status}: ${incident.title}]]></title>
			<description><![CDATA[${description}]]></description>
			<link>${guid}</link>
			<guid isPermaLink="true">${guid}</guid>
			<pubDate>${this.formatRssDate(latestUpdate)}</pubDate>
			<dc:creator>Statusflare</dc:creator>
			${categories}
		</item>`;
	}

	private generateItemDescription(incident: IncidentData): string {
		let description = `<p><strong>Status:</strong> ${this.getIncidentStatusText(incident.status)}</p>`;

		if (incident.description) {
			description += `<p>${this.escapeHtml(incident.description)}</p>`;
		}

		// Add timeline of updates
		if (incident.updates && incident.updates.length > 0) {
			description += '<h4>Timeline:</h4><ul>';

			// Show initial incident
			description += `<li><strong>${this.formatRssDate(incident.startedAt)}</strong> - ${this.getIncidentStatusText(incident.status)}: ${this.escapeHtml(incident.description || 'Incident reported')}</li>`;

			// Show updates
			incident.updates.forEach((update) => {
				description += `<li><strong>${this.formatRssDate(update.createdAt)}</strong> - ${this.getIncidentStatusText(update.status)}: ${this.escapeHtml(update.message)}</li>`;
			});

			description += '</ul>';
		}

		if (incident.resolvedAt) {
			description += `<p><strong>Resolved:</strong> ${this.formatRssDate(incident.resolvedAt)}</p>`;
		}

		return description;
	}

	private getIncidentCategories(incident: IncidentData): string {
		const categories = ['incident', 'status-update'];

		switch (incident.status) {
			case 'investigating':
			case 'identified':
				categories.push('outage');
				break;
			case 'resolved':
				categories.push('resolved');
				break;
			default:
				categories.push('update');
		}

		return categories.map((cat) => `<category>${cat}</category>`).join('\n\t\t\t');
	}

	private getIncidentStatusText(status: string): string {
		switch (status) {
			case 'investigating':
				return 'Investigating';
			case 'identified':
				return 'Identified';
			case 'update':
				return 'Update';
			case 'resolved':
				return 'Resolved';
			default:
				return status.charAt(0).toUpperCase() + status.slice(1);
		}
	}

	private formatRssDate(date: Date): string {
		// RFC 2822 format required for RSS
		return date.toUTCString();
	}

	private escapeHtml(text: string): string {
		return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
	}
}
