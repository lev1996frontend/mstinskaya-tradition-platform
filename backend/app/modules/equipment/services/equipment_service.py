from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.equipment.models import EquipmentCategory, EquipmentProduct, EquipmentRequest, ProductMedia, Supplier
from app.modules.identity.models import User
from app.modules.media.models import MediaFile


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
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid parent category id") from None
            parent = await session.get(EquipmentCategory, parsed_parent_id)
            if parent is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent category not found")
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
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category id") from None

        category = await session.get(EquipmentCategory, parsed_category_id)
        if category is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

        parsed_supplier_id = None
        if supplier_id is not None:
            try:
                parsed_supplier_id = UUID(str(supplier_id))
            except (ValueError, TypeError):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid supplier id") from None
            supplier = await session.get(Supplier, parsed_supplier_id)
            if supplier is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

        valid_statuses = {"ACTIVE", "INACTIVE", "DRAFT"}
        normalized_status = str(status).upper()
        if normalized_status not in valid_statuses:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product status")

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
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product id") from None

        try:
            parsed_media_file_id = UUID(str(media_file_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid media file id") from None

        product = await session.get(EquipmentProduct, parsed_product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        media_file = await session.get(MediaFile, parsed_media_file_id)
        if media_file is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found")

        existing = await session.execute(
            select(ProductMedia).where(ProductMedia.product_id == product.id, ProductMedia.media_file_id == media_file.id)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This media file is already attached to the product")

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
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id") from None

        user = await session.get(User, parsed_user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        try:
            parsed_product_id = UUID(str(product_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product id") from None

        product = await session.get(EquipmentProduct, parsed_product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        valid_statuses = {"NEW", "REVIEW", "APPROVED", "REJECTED"}
        normalized_status = str(status).upper()
        if normalized_status not in valid_statuses:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request status")

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
