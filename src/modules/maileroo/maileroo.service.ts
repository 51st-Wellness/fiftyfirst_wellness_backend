import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';

export interface MailerooContact {
  subscriber_name?: string;
  subscriber_email: string;
  subscriber_timezone?: string;
  subscriber_tags?: string;
  subscriber_status?:
    | 'SUBSCRIBED'
    | 'UNSUBSCRIBED'
    | 'UNCONFIRMED'
    | 'BOUNCED'
    | 'COMPLAINED';
  [key: string]: any; // For custom fields
}

export interface MailerooResponse {
  success: boolean;
  message: string;
  data?: any;
}

@Injectable()
export class MailerooService {
  private readonly logger = new Logger(MailerooService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://manage.maileroo.app/v1';
  private readonly newsletterListId: string;
  private readonly waitlistListId: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get(ENV.MAILEROO_CONTACTS_API_KEY);
    this.newsletterListId = this.configService.get(
      ENV.MAILEROO_NEWSLETTER_LIST_ID,
    );
    this.waitlistListId = this.configService.get(ENV.MAILEROO_WAITLIST_LIST_ID);

    console.log('Maileroo API key:', this.apiKey);
    console.log('Maileroo newsletter list ID:', this.newsletterListId);
    console.log('Maileroo waitlist list ID:', this.waitlistListId);
  }

  /**
   * Add a contact to a specific list
   */
  async addContact(
    listId: string,
    contact: MailerooContact,
  ): Promise<MailerooResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('Maileroo API key is not configured');
      }

      const response = await fetch(`${this.baseUrl}/contact/${listId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(contact),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error('Maileroo API error:', result);
        throw new Error(
          `Maileroo API error: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.log(
        `Contact added successfully to list ${listId}: ${contact.subscriber_email}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Error adding contact to Maileroo:', error.message);
      throw error;
    }
  }

  /**
   * Add a contact to the newsletter list
   */
  async addToNewsletter(
    email: string,
    name?: string,
  ): Promise<MailerooResponse> {
    const contact: MailerooContact = {
      subscriber_email: email,
      subscriber_name: name,
      subscriber_status: 'SUBSCRIBED',
      subscriber_tags: 'newsletter,website',
    };

    return this.addContact(this.newsletterListId, contact);
  }

  /**
   * Add a contact to the waitlist
   */
  async addToWaitlist(email: string, name?: string): Promise<MailerooResponse> {
    const contact: MailerooContact = {
      subscriber_email: email,
      subscriber_name: name,
      subscriber_status: 'SUBSCRIBED',
      subscriber_tags: 'waitlist,website',
    };

    return this.addContact(this.waitlistListId, contact);
  }

  /**
   * Update a contact in a specific list
   */
  async updateContact(
    listId: string,
    email: string,
    updates: Partial<MailerooContact>,
  ): Promise<MailerooResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('Maileroo API key is not configured');
      }

      const response = await fetch(
        `${this.baseUrl}/contact/${listId}/${encodeURIComponent(email)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
          },
          body: JSON.stringify(updates),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        this.logger.error('Maileroo API error:', result);
        throw new Error(
          `Maileroo API error: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.log(
        `Contact updated successfully in list ${listId}: ${email}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Error updating contact in Maileroo:', error.message);
      throw error;
    }
  }

  /**
   * Remove a contact from a specific list
   */
  async removeContact(
    listId: string,
    email: string,
  ): Promise<MailerooResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('Maileroo API key is not configured');
      }

      const response = await fetch(
        `${this.baseUrl}/contact/${listId}/${encodeURIComponent(email)}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
          },
        },
      );

      const result = await response.json();

      if (!response.ok) {
        this.logger.error('Maileroo API error:', result);
        throw new Error(
          `Maileroo API error: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.log(
        `Contact removed successfully from list ${listId}: ${email}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Error removing contact from Maileroo:', error.message);
      throw error;
    }
  }

  /**
   * Remove a contact from the newsletter list
   */
  async removeFromNewsletter(email: string): Promise<MailerooResponse> {
    return this.removeContact(this.newsletterListId, email);
  }

  /**
   * Remove a contact from the waitlist
   */
  async removeFromWaitlist(email: string): Promise<MailerooResponse> {
    return this.removeContact(this.waitlistListId, email);
  }

  /**
   * List contacts from a specific list
   */
  async listContacts(
    listId: string,
    query?: string,
    page = 1,
  ): Promise<MailerooResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('Maileroo API key is not configured');
      }

      const params = new URLSearchParams();
      if (query) params.append('query', query);
      params.append('page', page.toString());

      const response = await fetch(
        `${this.baseUrl}/contacts/${listId}?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
          },
        },
      );

      const result = await response.json();

      if (!response.ok) {
        this.logger.error('Maileroo API error:', result);
        throw new Error(
          `Maileroo API error: ${response.status} ${response.statusText}`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Error listing contacts from Maileroo:', error.message);
      throw error;
    }
  }
}
