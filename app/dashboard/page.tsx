import DashboardLayout from "@/components/dashboard-layout";
import StudentVault from "@/components/student-vault";
import TeacherUpload from "@/components/teacher-upload";

export default function DashboardPage() {
  return <DashboardLayout adminPanel={<TeacherUpload />} centrePanel={<StudentVault />} />;
}
