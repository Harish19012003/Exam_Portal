import { auditService } from '../services/audit.service.js';

/**
 * Middleware to automatically log mutating requests.
 * Extracts the user from req.user and the resource from the route path.
 */
export const auditLog = (action, resourceType) => {
  return async (req, res, next) => {
    // Capture the original send to intercept the response
    const originalSend = res.send;

    res.send = function (body) {
      res.send = originalSend;
      
      // Only log on successful mutations (200-299)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user?.id || null;
        const resourceId = req.params?.id || null;
        
        // This is fired asynchronously, so it doesn't block the response
        auditService.logAction({
          userId,
          action: action || req.method,
          resourceType: resourceType || req.baseUrl.split('/').pop(),
          resourceId,
          newData: req.body, // In a real app, you might want to sanitize this
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      }
      
      return res.send(body);
    };

    next();
  };
};
