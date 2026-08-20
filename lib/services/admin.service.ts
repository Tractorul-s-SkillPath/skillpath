import { getStudentsListRepo } from '../repositories/admin.repo';

export async function getStudentsListService() {
  // In the future, we can add a check here reading the 'auth_session' cookie
  // to ensure the user making this request is genuinely an admin.

  const students = await getStudentsListRepo();
  return students;
}