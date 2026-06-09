import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes';
import studentsRoutes from './modules/students/students.routes';
import employeesRoutes from './modules/employees/employees.routes';
import ppdbRoutes from './modules/ppdb/ppdb.routes';
import schedulesRoutes from './modules/schedules/schedules.routes';
import gradesRoutes from './modules/grades/grades.routes';
import reportCardsRoutes from './modules/reportCards/reportCards.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import leaveRequestsRoutes from './modules/leaveRequests/leaveRequests.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import {
  usersRouter,
  rolesRouter,
  permissionsRouter,
  auditLogsRouter,
  menuRouter,
} from './modules/rbac/rbac.routes';
import { buildMasterDataRouters } from './modules/masterData';

export const apiRouter = Router();

// Auth
apiRouter.use('/auth', authRoutes);

// RBAC management + nav
apiRouter.use('/users', usersRouter);
apiRouter.use('/roles', rolesRouter);
apiRouter.use('/permissions', permissionsRouter);
apiRouter.use('/audit-logs', auditLogsRouter);
apiRouter.use('/menu', menuRouter);

// Complex modules
apiRouter.use('/students', studentsRoutes);
apiRouter.use('/employees', employeesRoutes);
apiRouter.use('/ppdb', ppdbRoutes);
apiRouter.use('/schedules', schedulesRoutes);
apiRouter.use('/grades', gradesRoutes);
apiRouter.use('/report-cards', reportCardsRoutes);
apiRouter.use('/payments', paymentsRoutes);
apiRouter.use('/leave-requests', leaveRequestsRoutes);
apiRouter.use('/dashboard', dashboardRoutes);

// Generic CRUD master-data modules
for (const { path, router } of buildMasterDataRouters()) {
  apiRouter.use(path, router);
}

// Health check
apiRouter.get('/health', (_req, res) => {
  res.json({ success: true, message: 'SIAK An Nahl API is healthy', timestamp: new Date().toISOString() });
});
