import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { programsApi } from '../api/programs';
import { Card } from '../components/ui/Card';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { GraduationCap, Clock, Award, DollarSign } from 'lucide-react';

const TEMP_USER_ID = '1234567890';

export default function Programs() {
  const queryClient = useQueryClient();

  const { data: programs, isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: programsApi.getAll,
  });

  const { data: enrollments } = useQuery({
    queryKey: ['enrollments', TEMP_USER_ID],
    queryFn: () => programsApi.getEnrollments(TEMP_USER_ID),
  });

  const enrollMutation = useMutation({
    mutationFn: ({ programId }: { programId: string }) =>
      programsApi.enroll(TEMP_USER_ID, programId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const enrolledProgramIds = new Set(
    enrollments?.map((e) => e.programId) || []
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Programs</h1>
        <p className="mt-2 text-gray-600">
          Explore available CME programs and start earning credits.
        </p>
      </div>

      {/* My Enrollments */}
      {enrollments && enrollments.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            My Enrollments
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enrollments.map((enrollment) => (
              <Card key={enrollment.id}>
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg text-gray-900">
                    {enrollment.program.title}
                  </h3>
                  
                  <div className="flex items-center text-sm text-gray-600">
                    <Award className="w-4 h-4 mr-2" />
                    {enrollment.program.creditAmount} CME Credits
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium">
                        {enrollment.overallProgress}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all"
                        style={{ width: `${enrollment.overallProgress}%` }}
                      />
                    </div>
                  </div>

                  {enrollment.completed ? (
                    <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                      Completed
                    </span>
                  ) : (
                    <button className="btn-primary w-full">
                      Continue Learning
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Available Programs */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Available Programs
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs?.map((program) => {
            const isEnrolled = enrolledProgramIds.has(program.id);

            return (
              <Card key={program.id}>
                {program.thumbnailUrl && (
                  <img
                    src={program.thumbnailUrl}
                    alt={program.title}
                    className="w-full h-48 object-cover rounded-lg mb-4"
                  />
                )}

                <div className="space-y-3">
                  <h3 className="font-semibold text-lg text-gray-900">
                    {program.title}
                  </h3>

                  <p className="text-sm text-gray-600 line-clamp-2">
                    {program.description}
                  </p>

                  <div className="flex items-center text-sm text-gray-600">
                    <GraduationCap className="w-4 h-4 mr-2" />
                    {program.sponsorName}
                  </div>

                  <div className="flex items-center text-sm text-gray-600">
                    <Award className="w-4 h-4 mr-2" />
                    {program.creditAmount} CME Credits
                  </div>

                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="w-4 h-4 mr-2" />
                    {program.videos.length} Videos
                  </div>

                  {program.honorariumAmount && (
                    <div className="flex items-center text-sm font-medium text-green-600">
                      <DollarSign className="w-4 h-4 mr-1" />
                      ${program.honorariumAmount} Honorarium
                    </div>
                  )}

                  {isEnrolled ? (
                    <button className="btn-secondary w-full" disabled>
                      Already Enrolled
                    </button>
                  ) : (
                    <button
                      className="btn-primary w-full"
                      onClick={() => enrollMutation.mutate({ programId: program.id })}
                      disabled={enrollMutation.isPending}
                    >
                      {enrollMutation.isPending ? 'Enrolling...' : 'Enroll Now'}
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {programs?.length === 0 && (
        <div className="text-center py-12">
          <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No programs available at the moment.</p>
        </div>
      )}
    </div>
  );
}
