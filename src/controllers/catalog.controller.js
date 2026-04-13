import { getCatalogResponse } from '../services/catalog.service.js';

export async function getCatalog(req, res, next) {
  try {
    const data = await getCatalogResponse();
    return res.json({
      success: true,
      status: 'success',
      data
    });
  } catch (error) {
    return next(error);
  }
}
