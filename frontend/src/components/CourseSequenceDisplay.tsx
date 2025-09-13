import React from 'react';
import { TermCourses } from '@/services/courseSequenceService';

interface CourseSequenceDisplayProps {
  programName: string;
  year: number;
  term: string;
  courses: TermCourses;
}

const CourseSequenceDisplay: React.FC<CourseSequenceDisplayProps> = ({
  programName,
  year,
  term,
  courses
}) => {
  // Capitalize the first letter of the term
  const capitalizedTerm = term.charAt(0).toUpperCase() + term.slice(1);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 my-4">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
        {programName} - Year {year} - {capitalizedTerm} Term
      </h2>

      {courses.required && courses.required.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">
            Required Courses
          </h3>
          <div className="space-y-3">
            {courses.required.map((course) => (
              <div
                key={course.code}
                className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 dark:bg-gray-700 rounded"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-white">
                      {course.code}{course.name ? `: ${course.name}` : ''}
                    </h4>
                    {course.description && (
                      <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                        {course.description}
                      </p>
                    )}
                    {course.prerequisites && course.prerequisites.length > 0 && (
                      <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                        <span className="font-medium">Prerequisites:</span> {course.prerequisites.join(', ')}
                      </p>
                    )}
                  </div>
                  {course.credits && course.credits > 0 && (
                    <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs font-medium px-2.5 py-0.5 rounded">
                      {course.credits} credits
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {courses.electives && courses.electives.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">
            Elective Courses
          </h3>
          <div className="space-y-3">
            {courses.electives.map((course) => (
              <div
                key={course.code}
                className="border-l-4 border-green-500 pl-4 py-2 bg-gray-50 dark:bg-gray-700 rounded"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-white">
                      {course.code}{course.name ? `: ${course.name}` : ''}
                    </h4>
                    {course.description && (
                      <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                        {course.description}
                      </p>
                    )}
                    {course.prerequisites && course.prerequisites.length > 0 && (
                      <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                        <span className="font-medium">Prerequisites:</span> {course.prerequisites.join(', ')}
                      </p>
                    )}
                  </div>
                  {course.credits && course.credits > 0 && (
                    <span className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs font-medium px-2.5 py-0.5 rounded">
                      {course.credits} credits
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!courses.required || courses.required.length === 0) &&
        (!courses.electives || courses.electives.length === 0) && (
          <p className="text-gray-600 dark:text-gray-300">
            No courses found for this term.
          </p>
        )}
    </div>
  );
};

export default CourseSequenceDisplay;