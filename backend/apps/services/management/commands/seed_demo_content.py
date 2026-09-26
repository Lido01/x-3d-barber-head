from decimal import Decimal
from pathlib import Path
import shutil

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.bookings.models import Barber
from apps.gallery.models import GalleryPost
from apps.services.models import HaircutStyle, Service
from apps.testimonials.models import Testimonial


class Command(BaseCommand):
    help = "Seed realistic demo services, barbers, gallery posts, and testimonials."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show the seed plan without writing database or media files.",
        )
        parser.add_argument(
            "--refresh-images",
            action="store_true",
            help="Replace existing demo media files with the current seed assets.",
        )

    def handle(self, *args, **options):
        self.dry_run = options["dry_run"]
        self.refresh_images = options["refresh_images"]
        self.assets_root = Path(settings.BASE_DIR) / "seed_assets"

        if not self.assets_root.is_dir():
            raise CommandError(
                f"Seed assets directory does not exist: {self.assets_root}"
            )

        with transaction.atomic():
            services = self.seed_services()
            self.seed_styles(services)
            self.seed_barbers()
            self.seed_gallery(services)
            self.seed_testimonials()

        if self.dry_run:
            self.stdout.write("Demo content dry run complete; no changes were made.")
            return

        self.stdout.write(
            self.style.SUCCESS(
                "Demo content is ready: services, styles, barbers, gallery, and testimonials."
            )
        )

    def copy_asset(self, source_name, destination):
        source = self.assets_root / source_name
        destination_path = Path(settings.MEDIA_ROOT) / destination

        if not source.is_file():
            raise CommandError(f"Seed asset does not exist: {source}")

        if self.dry_run:
            return destination

        destination_path.parent.mkdir(parents=True, exist_ok=True)

        if self.refresh_images or not destination_path.exists():
            shutil.copy2(source, destination_path)

        return destination

    def upsert_service(
        self,
        name,
        aliases,
        price,
        duration,
        description,
        source_name,
        destination,
    ):
        service = Service.objects.filter(
            name__in=[name, *aliases]
        ).order_by("id").first()
        values = {
            "description": description,
            "price": Decimal(price),
            "duration": duration,
            "image": self.copy_asset(source_name, destination),
            "is_active": True,
        }

        if self.dry_run:
            return service or Service(name=name, **values)

        if service is None:
            return Service.objects.create(name=name, **values)

        for field, value in values.items():
            setattr(service, field, value)

        service.name = name
        service.save()
        return service

    def seed_services(self):
        specs = [
            {
                "name": "Signature Haircut",
                "aliases": ["Lidetu's Style"],
                "price": "450.00",
                "duration": 45,
                "description": "A tailored cut built around your head shape, hair type, and everyday styling routine.",
                "source_name": "signature-cut.jpg",
                "destination": "services/demo-signature-haircut.jpg",
            },
            {
                "name": "Skin Fade",
                "aliases": [],
                "price": "650.00",
                "duration": 60,
                "description": "A seamless skin fade, sharp neckline, and balanced finish for a clean modern silhouette.",
                "source_name": "skin-fade.jpg",
                "destination": "services/demo-skin-fade.jpg",
            },
            {
                "name": "Low Fade",
                "aliases": ["Fade haircut"],
                "price": "550.00",
                "duration": 45,
                "description": "A refined low transition that keeps the sides neat while giving the top natural movement.",
                "source_name": "low-fade.jpg",
                "destination": "services/demo-low-fade.jpg",
            },
            {
                "name": "Classic Cut",
                "aliases": ["Short Fade New"],
                "price": "400.00",
                "duration": 40,
                "description": "A timeless side part and precision scissor work, finished with simple styling advice.",
                "source_name": "classic-cut.jpg",
                "destination": "services/demo-classic-cut.jpg",
            },
            {
                "name": "Beard Sculpt",
                "aliases": [],
                "price": "350.00",
                "duration": 30,
                "description": "Beard shaping, line-up, and a clean finish designed to frame your face.",
                "source_name": "classic-cut.jpg",
                "destination": "services/demo-beard-sculpt.jpg",
            },
            {
                "name": "Haircut + Beard",
                "aliases": [],
                "price": "850.00",
                "duration": 75,
                "description": "The complete reset: a precision haircut paired with a tailored beard shape and finish.",
                "source_name": "signature-cut.jpg",
                "destination": "services/demo-haircut-beard.jpg",
            },
        ]

        return {
            spec["name"]: self.upsert_service(**spec)
            for spec in specs
        }

    def upsert_style(
        self,
        service,
        name,
        aliases,
        description,
        source_name,
        destination,
    ):
        style = None
        if service.pk:
            style = HaircutStyle.objects.filter(
                service=service,
                name__in=[name, *aliases],
            ).order_by("id").first()
        values = {
            "description": description,
            "image": self.copy_asset(source_name, destination),
            "is_active": True,
        }

        if self.dry_run:
            return style or HaircutStyle(service=service, name=name, **values)

        if style is None:
            return HaircutStyle.objects.create(
                service=service,
                name=name,
                **values,
            )

        for field, value in values.items():
            setattr(style, field, value)

        style.name = name
        style.save()
        return style

    def seed_styles(self, services):
        specs = {
            "Signature Haircut": [
                (
                    "Classic Side Part",
                    [],
                    "A clean, dimensional side part with a soft edge and controlled volume.",
                    "classic-cut.jpg",
                    "haircut_styles/demo-classic-side-part.jpg",
                ),
                (
                    "Textured Crop",
                    [],
                    "A relaxed crop with airy texture that stays easy to style between appointments.",
                    "textured-crop.jpg",
                    "haircut_styles/demo-textured-crop.jpg",
                ),
            ],
            "Skin Fade": [
                (
                    "Clean Skin Fade",
                    [],
                    "A seamless transition from skin to the shortest taper, shaped to your head.",
                    "skin-fade.jpg",
                    "haircut_styles/demo-clean-skin-fade.jpg",
                ),
                (
                    "High Fade",
                    [],
                    "A bold high transition with a crisp outline and a strong, modern profile.",
                    "low-fade.jpg",
                    "haircut_styles/demo-high-fade.jpg",
                ),
            ],
            "Low Fade": [
                (
                    "Tapered Low Fade",
                    ["Low Fade"],
                    "A subtle low taper that keeps the look polished without losing texture on top.",
                    "low-fade.jpg",
                    "haircut_styles/demo-tapered-low-fade.jpg",
                ),
                (
                    "Mid Fade",
                    [],
                    "A balanced mid fade for an easy everyday shape and a sharper silhouette.",
                    "skin-fade.jpg",
                    "haircut_styles/demo-mid-fade.jpg",
                ),
            ],
            "Classic Cut": [
                (
                    "Timeless Side Part",
                    [],
                    "A tailored side part with a comfortable fit and a polished finish.",
                    "classic-cut.jpg",
                    "haircut_styles/demo-timeless-side-part.jpg",
                ),
                (
                    "Clean Crop",
                    [],
                    "A neat all-around crop that looks intentional with almost no styling.",
                    "signature-cut.jpg",
                    "haircut_styles/demo-clean-crop.jpg",
                ),
            ],
            "Beard Sculpt": [
                (
                    "Beard Shape",
                    [],
                    "A precise outline and softened interior that makes the whole face look intentional.",
                    "classic-cut.jpg",
                    "haircut_styles/demo-beard-shape.jpg",
                ),
                (
                    "Full Beard Finish",
                    [],
                    "A full beard shaped for density, balance, and an easy daily routine.",
                    "low-fade.jpg",
                    "haircut_styles/demo-full-beard-finish.jpg",
                ),
            ],
            "Haircut + Beard": [
                (
                    "Signature Cut + Beard",
                    [],
                    "Our signature haircut paired with a balanced beard line for a complete refresh.",
                    "signature-cut.jpg",
                    "haircut_styles/demo-signature-cut-beard.jpg",
                ),
                (
                    "Fresh Fade + Beard",
                    [],
                    "A crisp fade and shaped beard finished together for a sharp, camera-ready look.",
                    "skin-fade.jpg",
                    "haircut_styles/demo-fresh-fade-beard.jpg",
                ),
            ],
        }

        for service_name, styles in specs.items():
            for style_spec in styles:
                self.upsert_style(services[service_name], *style_spec)

    def upsert_barber(
        self,
        name,
        aliases,
        role,
        specialty,
        experience,
        bio,
        source_name,
        destination,
    ):
        barber = Barber.objects.filter(
            name__in=[name, *aliases]
        ).order_by("id").first()
        values = {
            "role": role,
            "specialty": specialty,
            "experience": experience,
            "bio": bio,
            "image": self.copy_asset(source_name, destination),
            "phone": "",
            "is_active": True,
        }

        if self.dry_run:
            return barber or Barber(name=name, **values)

        if barber is None:
            return Barber.objects.create(name=name, **values)

        for field, value in values.items():
            setattr(barber, field, value)

        barber.name = name
        barber.save()
        return barber

    def seed_barbers(self):
        specs = [
            (
                "Lidetu Tesfaye",
                [],
                "Master Barber",
                "Fades, texture, and precision detail",
                "8 years",
                "Lidetu blends sharp fades with easy-to-wear texture. His favorite detail is a clean neckline that keeps the whole cut looking intentional.",
                "barber-mikael.jpg",
                "barbers/lidetu-tesfaye.jpg",
            ),
            (
                "Samuel Bekele",
                ["Tesfaye"],
                "Senior Barber",
                "Classic cuts and beard design",
                "6 years",
                "Samuel is known for polished side parts, thoughtful fades, and beard work that keeps every profile balanced.",
                "barber-samuel.jpg",
                "barbers/samuel-bekele.jpg",
            ),
            (
                "Dawit Alemu",
                [],
                "Barber & Stylist",
                "Modern cuts, curls, and styling",
                "4 years",
                "Dawit works with curls, coils, and textured hair, building cuts that grow out with personality instead of losing shape.",
                "barber-dawit.jpg",
                "barbers/dawit-alemu.jpg",
            ),
        ]

        return [self.upsert_barber(*spec) for spec in specs]

    def upsert_gallery(
        self,
        title,
        aliases,
        service,
        style_name,
        description,
        source_name,
        destination,
    ):
        post = GalleryPost.objects.filter(
            title__in=[title, *aliases]
        ).order_by("id").first()
        values = {
            "description": description,
            "style_name": style_name,
            "service": service,
            "image": self.copy_asset(source_name, destination),
            "is_active": True,
        }

        if self.dry_run:
            return post or GalleryPost(title=title, **values)

        if post is None:
            return GalleryPost.objects.create(title=title, **values)

        for field, value in values.items():
            setattr(post, field, value)

        post.title = title
        post.save()
        return post

    def seed_gallery(self, services):
        specs = [
            (
                "The Clean Fade",
                ["SHIRO SNAP"],
                services["Skin Fade"],
                "Skin Fade",
                "Crisp edges, a seamless transition, and a finish that stays sharp all week.",
                "skin-fade.jpg",
                "gallery/demo-clean-fade.jpg",
            ),
            (
                "Quiet Luxury",
                [],
                services["Low Fade"],
                "Low Fade",
                "A low taper with a soft top for a polished look that works from desk to dinner.",
                "low-fade.jpg",
                "gallery/demo-quiet-luxury.jpg",
            ),
            (
                "Soft Texture",
                [],
                services["Signature Haircut"],
                "Textured Crop",
                "Airy movement and a natural finish make this the easiest cut to wear every day.",
                "textured-crop.jpg",
                "gallery/demo-soft-texture.jpg",
            ),
            (
                "The Sharp Side",
                [],
                services["Classic Cut"],
                "Classic Side Part",
                "A precise side part with a comfortable shape and a little old-school polish.",
                "classic-cut.jpg",
                "gallery/demo-sharp-side.jpg",
            ),
            (
                "Full Finish",
                [],
                services["Haircut + Beard"],
                "Signature Cut + Beard",
                "A complete reset with a clean haircut, balanced beard shape, and a confident finish.",
                "signature-cut.jpg",
                "gallery/demo-full-finish.jpg",
            ),
            (
                "Golden Hour",
                [],
                services["Signature Haircut"],
                "Textured Crop",
                "A relaxed textured cut designed to catch light and make styling feel effortless.",
                "signature-cut.jpg",
                "gallery/demo-golden-hour.jpg",
            ),
            (
                "Clean Lines",
                [],
                services["Beard Sculpt"],
                "Beard Shape",
                "A thoughtful beard line and softened interior make the whole look feel deliberate.",
                "classic-cut.jpg",
                "gallery/demo-clean-lines.jpg",
            ),
            (
                "Weekend Ready",
                [],
                services["Classic Cut"],
                "Clean Crop",
                "A low-maintenance cut that looks good straight out of the chair and easy to refresh.",
                "low-fade.jpg",
                "gallery/demo-weekend-ready.jpg",
            ),
        ]

        return [self.upsert_gallery(*spec) for spec in specs]

    def upsert_testimonial(
        self,
        name,
        aliases,
        message,
        rating,
        status,
        source_name=None,
        destination=None,
    ):
        testimonial = Testimonial.objects.filter(
            customer_name__in=[name, *aliases]
        ).order_by("id").first()
        photo = self.copy_asset(source_name, destination) if source_name else ""
        values = {
            "customer_phone": "",
            "message": message,
            "rating": rating,
            "photo": photo,
            "status": status,
        }

        if self.dry_run:
            return testimonial or Testimonial(customer_name=name, **values)

        if testimonial is None:
            return Testimonial.objects.create(customer_name=name, **values)

        for field, value in values.items():
            setattr(testimonial, field, value)

        testimonial.customer_name = name
        testimonial.save()
        return testimonial

    def seed_testimonials(self):
        specs = [
            (
                "Adonay M.",
                ["Adonay"],
                "The fade was crisp, the shape suits me perfectly, and the whole visit felt calm and professional.",
                5,
                Testimonial.Status.APPROVED,
                "textured-crop.jpg",
                "testimonials/demo-adonay.jpg",
            ),
            (
                "Samuel B.",
                ["Tesfaye"],
                "I came in with a picture and left with a cut that feels even better in person. Great attention to detail.",
                5,
                Testimonial.Status.APPROVED,
                "skin-fade.jpg",
                "testimonials/demo-samuel.jpg",
            ),
            (
                "Mekdes A.",
                [],
                "The texture advice was practical and easy to follow. My hair still looks good on day four.",
                5,
                Testimonial.Status.APPROVED,
                "low-fade.jpg",
                "testimonials/demo-mekdes.jpg",
            ),
            (
                "Yonas K.",
                [],
                "Clean beard work, a comfortable chair, and no unnecessary fuss. I will be back next month.",
                5,
                Testimonial.Status.APPROVED,
                "signature-cut.jpg",
                "testimonials/demo-yonas.jpg",
            ),
            (
                "Selam G.",
                [],
                "My curls finally have a shape that I can style at home. The finish is fresh but still natural.",
                4,
                Testimonial.Status.APPROVED,
                "classic-cut.jpg",
                "testimonials/demo-selam.jpg",
            ),
            (
                "Amanuel T.",
                [],
                "Quick, professional, and thoughtful. I walked in with a busy schedule and out on time looking sharp.",
                5,
                Testimonial.Status.APPROVED,
                "signature-cut.jpg",
                "testimonials/demo-amanuel.jpg",
            ),
        ]

        return [self.upsert_testimonial(*spec) for spec in specs]
