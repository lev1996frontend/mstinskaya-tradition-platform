from __future__ import annotations

from typing import get_args
from uuid import UUID

from fastapi import HTTPException
from fastapi import status as http_status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.identity_access import get_user_or_404
from app.modules.equipment.models import EquipmentCategory, EquipmentProduct, EquipmentRequest, ProductMedia, Supplier
from app.modules.equipment.schemas.product import ProductStatus
from app.modules.equipment.schemas.request import RequestStatus
from app.modules.media.service import MediaService

_VALID_PRODUCT_STATUSES = frozenset(get_args(ProductStatus))
_VALID_REQUEST_STATUSES = frozenset(get_args(RequestStatus))


class EquipmentService:
    @staticmethod
    async def create_supplier(session: AsyncSession, *, name: str, description: str | None, website: str | None, email: str | None, phone: str | None, city: str | None, country: str | None) -> Supplier:
        supplier = Supplier(
            name=name,
            description=description,
            website=website,
            email=email,
            phone=phone,
            city=city,
            country=country,
        )
        session.add(supplier)
        await session.flush()
        return supplier

    @staticmethod
    async def create_category(session: AsyncSession, *, name: str, description: str | None, parent_id: str | None) -> EquipmentCategory:
        category = EquipmentCategory(name=name, description=description)
        if parent_id:
            try:
                parsed_parent_id = UUID(str(parent_id))
            except (ValueError, TypeError):
                raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Invalid parent category id") from None
            parent = await session.get(EquipmentCategory, parsed_parent_id)
            if parent is None:
                raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Parent category not found")
            category.parent_id = parent.id
        session.add(category)
        await session.flush()
        return category

    @staticmethod
    async def create_product(
        session: AsyncSession,
        *,
        category_id: str,
        supplier_id: str | None,
        name: str,
        description: str | None,
        manufacturer: str | None,
        price: float,
        currency: str,
        status: str,
    ) -> EquipmentProduct:
        try:
            parsed_category_id = UUID(str(category_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Invalid category id") from None

        category = await session.get(EquipmentCategory, parsed_category_id)
        if category is None:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Category not found")

        parsed_supplier_id = None
        if supplier_id is not None:
            try:
                parsed_supplier_id = UUID(str(supplier_id))
            except (ValueError, TypeError):
                raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Invalid supplier id") from None
            supplier = await session.get(Supplier, parsed_supplier_id)
            if supplier is None:
                raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Supplier not found")

        normalized_status = str(status).upper()
        if normalized_status not in _VALID_PRODUCT_STATUSES:
            raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Invalid product status")

        product = EquipmentProduct(
            category_id=category.id,
            supplier_id=parsed_supplier_id,
            name=name,
            description=description,
            manufacturer=manufacturer,
            price=float(price),
            currency=str(currency).upper(),
            status=normalized_status,
        )
        session.add(product)
        await session.flush()
        return product

    @staticmethod
    async def create_product_media(session: AsyncSession, *, product_id: str, media_file_id: str, order_number: int) -> ProductMedia:
        try:
            parsed_product_id = UUID(str(product_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Invalid product id") from None

        try:
            parsed_media_file_id = UUID(str(media_file_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Invalid media file id") from None

        product = await session.get(EquipmentProduct, parsed_product_id)
        if product is None:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Product not found")

        media_file = await MediaService(session).get_media_file(parsed_media_file_id)
        if media_file is None:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Media file not found")

        existing = await session.execute(
            select(ProductMedia).where(ProductMedia.product_id == product.id, ProductMedia.media_file_id == media_file.id)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail="This media file is already attached to the product")

        entry = ProductMedia(product_id=product.id, media_file_id=media_file.id, order_number=order_number)
        session.add(entry)
        await session.flush()
        return entry

    @staticmethod
    async def create_request(
        session: AsyncSession,
        *,
        user_id: str,
        product_id: str,
        quantity: int,
        comment: str | None,
        status: str,
    ) -> EquipmentRequest:
        try:
            parsed_user_id = UUID(str(user_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Invalid user id") from None

        user = await get_user_or_404(session, parsed_user_id)

        try:
            parsed_product_id = UUID(str(product_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Invalid product id") from None

        product = await session.get(EquipmentProduct, parsed_product_id)
        if product is None:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Product not found")

        normalized_status = str(status).upper()
        if normalized_status not in _VALID_REQUEST_STATUSES:
            raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Invalid request status")

        request = EquipmentRequest(
            user_id=user.id,
            product_id=product.id,
            quantity=quantity,
            comment=comment,
            status=normalized_status,
        )
        session.add(request)
        await session.flush()
        return request
