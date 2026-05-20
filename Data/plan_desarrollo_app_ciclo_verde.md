# Plan Completo de Desarrollo - App Web Ciclo Verde

## 1. Visión General de la Aplicación

La aplicación web "Ciclo Verde" será una plataforma para gestionar la recolección de residuos reciclables entre restaurantes y una empresa recolectora.

La plataforma permitirá:

- Registro e inicio de sesión de usuarios.
- Gestión de perfiles.
- Solicitud y seguimiento de recolecciones.
- Registro de residuos.
- Administración de usuarios.
- Historial de servicios.
- Panel administrativo.
- Estados de pedidos y rutas de recolección.

---

# 2. Tipos de Usuarios

## Usuario Restaurante
Puede:

- Registrarse.
- Iniciar sesión.
- Editar perfil.
- Solicitar recolecciones.
- Registrar residuos.
- Ver historial.
- Ver estados de pedidos.
- Eliminar su cuenta.

## Usuario Administrador
Puede:

- Ver todos los usuarios.
- Gestionar usuarios.
- Eliminar cuentas.
- Aprobar o gestionar recolecciones.
- Cambiar estados.
- Ver estadísticas.
- Gestionar residuos.
- Supervisar toda la plataforma.

---

# 3. Requerimientos Funcionales

## Módulo de Usuarios

### RF-01 Registro de usuarios
El sistema debe permitir registrar usuarios mediante:

- Nombre
- Correo electrónico
- Contraseña
- Tipo de usuario

### RF-02 Inicio de sesión
El sistema debe permitir iniciar sesión mediante correo y contraseña.

### RF-03 Recuperación de contraseña
El usuario podrá recuperar su contraseña mediante correo electrónico.

### RF-04 Cierre de sesión
El usuario podrá cerrar sesión.

### RF-05 Eliminación de cuenta
El usuario podrá eliminar su cuenta.

### RF-06 Edición de perfil
El usuario podrá modificar:

- Nombre
- Teléfono
- Dirección
- Foto de perfil

---

## Módulo de Recolección

### RF-07 Crear solicitud de recolección
El restaurante podrá solicitar una recolección indicando:

- Fecha
- Hora
- Tipo de residuos
- Cantidad aproximada
- Dirección

### RF-08 Ver estado de solicitud
Los usuarios podrán visualizar:

- Pendiente
- Aprobado
- En camino
- Completado
- Cancelado

### RF-09 Historial de recolecciones
El restaurante podrá visualizar sus solicitudes anteriores.

### RF-10 Cancelar solicitud
El restaurante podrá cancelar solicitudes pendientes.

---

## Módulo de Inventario de Residuos

### RF-11 Registrar residuos
El restaurante podrá registrar:

- Tipo de residuo
- Peso
- Cantidad
- Fecha

### RF-12 Consultar residuos registrados
El usuario podrá ver registros anteriores.

---

## Módulo Administrativo

### RF-13 Gestión de usuarios
El administrador podrá:

- Ver usuarios
- Editar usuarios
- Desactivar usuarios
- Eliminar usuarios

### RF-14 Gestión de solicitudes
El administrador podrá:

- Aprobar solicitudes
- Asignar rutas
- Cambiar estados
- Ver detalles

### RF-15 Dashboard administrativo
El administrador podrá visualizar:

- Cantidad de recolecciones
- Usuarios registrados
- Residuos recolectados
- Estadísticas generales

---

# 4. Requerimientos No Funcionales

## RNF-01 Seguridad
- Contraseñas cifradas.
- Autenticación segura.
- Protección de rutas.
- Validación de formularios.

## RNF-02 Rendimiento
- Tiempo de carga menor a 3 segundos.
- Optimización de imágenes.

## RNF-03 Escalabilidad
La aplicación debe soportar crecimiento de usuarios.

## RNF-04 Disponibilidad
La app debe estar disponible 24/7.

## RNF-05 Compatibilidad
Compatible con:

- Computadores
- Tablets
- Celulares

## RNF-06 Responsividad
La interfaz debe adaptarse a distintos tamaños de pantalla.

## RNF-07 Usabilidad
La aplicación debe ser sencilla e intuitiva.

## RNF-08 Base de datos segura
La información debe almacenarse de manera segura.

---

# 5. Tecnologías Recomendadas

## Frontend

### Recomendado: Next.js + React + TypeScript

¿Por qué?

- Moderno.
- Muy usado.
- Escalable.
- Excelente para apps web.
- Fácil despliegue.
- Compatible con Tailwind.

### Librerías recomendadas

- React
- Next.js
- TypeScript
- Tailwind CSS
- Shadcn UI
- React Hook Form
- Zod
- Axios

---

## Backend

## Opción Recomendada: Supabase

### ¿Por qué Supabase?

- Gratis para comenzar.
- Base de datos PostgreSQL.
- Autenticación incluida.
- API automática.
- Manejo de usuarios.
- Storage para imágenes.
- Panel administrativo.
- Seguridad integrada.
- Más rápido para MVP.

### Servicios de Supabase que usarán

- Supabase Auth
- Supabase Database
- Supabase Storage
- Row Level Security
- Realtime (opcional)

---

## Base de Datos

### PostgreSQL

Tablas recomendadas:

- users
- profiles
- pickups
- pickup_status
- waste_records
- notifications
- admin_logs

---

# 6. Arquitectura Recomendada

## Frontend

Responsable de:

- Interfaces.
- Formularios.
- Navegación.
- Dashboard.
- Consumo de APIs.

## Backend

Responsable de:

- Autenticación.
- Base de datos.
- Validaciones.
- Seguridad.
- Reglas de negocio.

## Base de Datos

Responsable de:

- Guardar usuarios.
- Guardar solicitudes.
- Guardar residuos.
- Guardar historial.

---

# 7. Diseño Inicial de Base de Datos

## Tabla users

- id
- email
- password
- role
- created_at

## Tabla profiles

- id
- user_id
- full_name
- phone
- address
- avatar_url

## Tabla pickups

- id
- user_id
- date
- hour
- status
- address
- created_at

## Tabla waste_records

- id
- user_id
- waste_type
- quantity
- weight
- created_at

## Tabla notifications

- id
- user_id
- title
- message
- read

---

# 8. Flujo General de la Aplicación

## Restaurante

1. Se registra.
2. Inicia sesión.
3. Completa perfil.
4. Registra residuos.
5. Solicita recolección.
6. Observa estado.
7. Consulta historial.

## Administrador

1. Inicia sesión.
2. Ve solicitudes.
3. Cambia estados.
4. Gestiona usuarios.
5. Ve estadísticas.

---

# 9. Orden Correcto de Desarrollo

# Sprint 1 - Configuración Inicial

Objetivo:
Preparar toda la base del proyecto.

Implementar:

- Crear repositorio GitHub.
- Configurar Next.js.
- Configurar TypeScript.
- Configurar Tailwind.
- Configurar Supabase.
- Crear estructura de carpetas.
- Configurar rutas.
- Configurar variables de entorno.
- Crear diseño base.

Resultado:
Proyecto listo para desarrollar.

---

# Sprint 2 - Autenticación

Implementar:

- Registro.
- Login.
- Logout.
- Recuperación de contraseña.
- Protección de rutas.
- Roles de usuario.

Frontend:

- Formularios.
- Validaciones.
- Pantallas de login.

Backend:

- Supabase Auth.
- Policies.
- Manejo de sesión.

Resultado:
Sistema de usuarios funcionando.

---

# Sprint 3 - Perfil de Usuario

Implementar:

- Ver perfil.
- Editar perfil.
- Subir imagen.
- Eliminar cuenta.

Frontend:

- Dashboard.
- Formularios.

Backend:

- Tabla profiles.
- Storage imágenes.

Resultado:
Usuarios gestionan su cuenta.

---

# Sprint 4 - Recolecciones

Implementar:

- Crear solicitud.
- Ver solicitudes.
- Cancelar solicitud.
- Estados.

Frontend:

- Formularios.
- Tablas.
- Cards.

Backend:

- Tabla pickups.
- Validaciones.

Resultado:
Sistema principal funcionando.

---

# Sprint 5 - Inventario de Residuos

Implementar:

- Registrar residuos.
- Ver historial.
- Estadísticas básicas.

Backend:

- Tabla waste_records.

Resultado:
Inventario funcional.

---

# Sprint 6 - Panel Administrador

Implementar:

- Gestión usuarios.
- Gestión solicitudes.
- Dashboard.
- Estadísticas.

Frontend:

- Dashboard admin.
- Gráficas.
- Tablas.

Backend:

- Policies admin.
- Queries avanzadas.

Resultado:
Administrador completo.

---

# Sprint 7 - Mejoras Finales

Implementar:

- Responsive.
- Optimización.
- Notificaciones.
- Corrección errores.
- Seguridad.
- Testing.

Resultado:
Aplicación lista para producción.

---

# 10. Estructura Recomendada del Proyecto

## Frontend

/app
/components
/lib
/hooks
/services
/types
/styles

---

# 11. Servicios Gratuitos Recomendados

## Hosting Frontend

### Recomendado: Vercel

- Gratis.
- Fácil despliegue.
- Perfecto para Next.js.

## Backend y Base de Datos

### Recomendado: Supabase

- Auth.
- PostgreSQL.
- Storage.
- APIs.

## Control de versiones

### GitHub

---

# 12. Recomendación Técnica Final

La mejor combinación para esta aplicación actualmente es:

- Frontend: Next.js + TypeScript + Tailwind.
- Backend: Supabase.
- Base de datos: PostgreSQL.
- Hosting: Vercel.
- Diseño UI: Shadcn UI.

Porque:

- Es gratis para iniciar.
- Escalable.
- Profesional.
- Fácil de mantener.
- Excelente para portafolio.
- Muy usado en la industria.

---

# 13. Funcionalidades Futuras

A futuro puedes agregar:

- Geolocalización.
- Mapas.
- Chat en tiempo real.
- Notificaciones push.
- IA para clasificación de residuos.
- Reportes PDF.
- Aplicación móvil.
- Gamificación.
- Sistema de puntos ecológicos.

---

# 14. Prioridad de Desarrollo

## Alta Prioridad (MVP)

- Login.
- Registro.
- Solicitudes.
- Estados.
- Historial.
- Admin.

## Media Prioridad

- Estadísticas.
- Notificaciones.
- Dashboard avanzado.

## Baja Prioridad

- Chat.
- Mapas.
- IA.
- Gamificación.

