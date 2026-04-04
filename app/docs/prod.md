# Production Data Model Notes

This document describes the current production-oriented model for the `land_plots` database.

## Core collection: plots

Each document stores:

- listing fields (title, description, price, area_sotki, location, address)
- geo fields (lat, lon, geo_location)
- derived feature fields (features, feature_score, features_text)
- derived geo fields (distances, infra_score, negative_score)
- final ranking field (total_score)
- metadata (created_at, updated_at, owner_id, owner_name)

## Search flow in backend

- Candidate loading from `plots`
- BM25 pre-ranking
- Combined score based on feature_score and BM25 score
- Jina reranking

## Notes

- Legacy documents should be cleaned with `$unset` migration.
