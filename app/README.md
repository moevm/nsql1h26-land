# Land Plots Service

Service for viewing, searching, and ranking land plot listings.

## Search pipeline

1. Hard filters by price and area.
2. BM25 ranking by title and description text.
3. Combined score: ALPHA * feature_score_norm + BETA * bm25_score_norm.
4. Jina reranker for final semantic reordering.

## Auto-calculated fields for plots

- features
- feature_score
- features_text
- distances
- infra_score
- negative_score
- total_score

## MongoDB indexes in use

- plots.geo_location (2dsphere)
- plots.avito_id (unique, sparse)
- plots.price
- plots.area_sotki
- plots.total_score

## Run

```bash
cd app
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
