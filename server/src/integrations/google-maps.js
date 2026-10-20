import axios from 'axios';
import env from '../config/env.js';
import { logger } from '../core/logger.js';

const GOOGLE_MAPS_API = 'https://maps.googleapis.com/maps/api';

export const googleMapsService = {
  /**
   * Get geocoding data (lat, lng) for an address
   */
  async geocode(address) {
    try {
      const res = await axios.get(`${GOOGLE_MAPS_API}/geocode/json`, {
        params: {
          address,
          key: env.GOOGLE_MAPS_API_KEY || 'demo-key'
        }
      });
      if (res.data.status !== 'OK') throw new Error(res.data.status);
      return res.data.results[0];
    } catch (error) {
      logger.error(`[GoogleMaps] Geocode failed for ${address}`, error.message);
      throw error;
    }
  },

  /**
   * Calculate distance between two places
   */
  async getDistance(origin, destination) {
    try {
      const res = await axios.get(`${GOOGLE_MAPS_API}/distancematrix/json`, {
        params: {
          origins: origin,
          destinations: destination,
          key: env.GOOGLE_MAPS_API_KEY || 'demo-key'
        }
      });
      if (res.data.status !== 'OK') throw new Error(res.data.status);
      const element = res.data.rows[0].elements[0];
      if (element.status !== 'OK') throw new Error(element.status);
      
      return {
        distance: element.distance.text, // e.g. "15 km"
        duration: element.duration.text, // e.g. "20 mins"
        valueMeters: element.distance.value
      };
    } catch (error) {
      logger.error(`[GoogleMaps] Distance matrix failed`, error.message);
      throw error;
    }
  }
};
