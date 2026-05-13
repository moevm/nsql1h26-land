from __future__ import annotations


class DomainError(Exception):
    pass


class NotFoundError(DomainError):
    def __init__(self, entity: str, entity_id: str | None = None):
        msg = f"{entity} not found"
        if entity_id:
            msg += f" (id={entity_id})"
        super().__init__(msg)


class NotAuthorizedError(DomainError):
    pass


class ConflictError(DomainError):
    pass


class InvalidIdError(DomainError):
    def __init__(self):
        super().__init__("Invalid ID")


class ValidationError(DomainError):
    pass
