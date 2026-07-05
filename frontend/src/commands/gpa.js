export const gpaCommand = {
  name: 'gpa',
  description: 'GPA calculator for academic performance',
  icon: '🎓',
  
  execute(input) {
    const action = input.replace(/^gpa\s*/i, '').trim();
    
    if (!action || action === 'show' || action === 'list') {
      return this.showGPA();
    } else if (action.startsWith('add ')) {
      return this.addCourse(action.substring(4));
    } else if (action.startsWith('remove ')) {
      const courseId = action.substring(7);
      return this.removeCourse(courseId);
    } else if (action === 'clear') {
      return this.clearCourses();
    } else if (action === 'calculate' || action === 'calc') {
      return this.calculateGPA();
    } else {
      // Try to parse as course data
      return this.addCourse(action);
    }
  },

  addCourse(courseData) {
    try {
      // Parse course data: "CourseName credits grade" or "CourseName credits"
      const parts = courseData.trim().split(/\s+/);
      
      if (parts.length < 2) {
        return {
          success: false,
          error: 'Format: /gpa add "Course Name" credits grade\nExample: /gpa add "Math 101" 3 A'
        };
      }

      let courseName, credits, grade;
      
      // Handle course names with spaces
      if (courseData.includes('"')) {
        const quotedMatch = courseData.match(/"([^"]+)"\s+(\d+(?:\.\d+)?)\s*([A-Za-z+-]?)/);
        if (!quotedMatch) {
          return {
            success: false,
            error: 'Invalid format. Use: /gpa add "Course Name" credits grade'
          };
        }
        [, courseName, credits, grade] = quotedMatch;
      } else {
        // Simple format: courseName credits grade
        courseName = parts[0];
        credits = parts[1];
        grade = parts[2] || '';
      }

      const creditHours = parseFloat(credits);
      if (isNaN(creditHours) || creditHours <= 0) {
        return {
          success: false,
          error: 'Invalid credit hours. Must be a positive number.'
        };
      }

      const courses = this.getCourses();
      const newCourse = {
        id: Date.now().toString(),
        name: courseName,
        credits: creditHours,
        grade: grade || 'IP', // IP = In Progress
        gradePoints: grade ? this.getGradePoints(grade) : 0,
        createdAt: new Date().toISOString()
      };

      courses.push(newCourse);
      this.saveCourses(courses);

      const message = grade 
        ? `Added "${courseName}" (${creditHours} credits, grade: ${grade})`
        : `Added "${courseName}" (${creditHours} credits, in progress)`;

      return {
        success: true,
        action: 'add',
        course: newCourse,
        message
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to add course'
      };
    }
  },

  removeCourse(courseId) {
    try {
      const courses = this.getCourses();
      const courseIndex = courses.findIndex(c => c.id === courseId);
      
      if (courseIndex === -1) {
        return {
          success: false,
          error: 'Course not found'
        };
      }

      const deletedCourse = courses.splice(courseIndex, 1)[0];
      this.saveCourses(courses);
      
      return {
        success: true,
        action: 'remove',
        course: deletedCourse,
        message: `Removed "${deletedCourse.name}"`
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to remove course'
      };
    }
  },

  calculateGPA() {
    try {
      const courses = this.getCourses();
      const gradedCourses = courses.filter(c => c.grade && c.grade !== 'IP');
      
      if (gradedCourses.length === 0) {
        return {
          success: false,
          error: 'No graded courses found. Add courses with grades to calculate GPA.'
        };
      }

      const totalCredits = gradedCourses.reduce((sum, course) => sum + course.credits, 0);
      const totalGradePoints = gradedCourses.reduce((sum, course) => sum + (course.gradePoints * course.credits), 0);
      const gpa = totalGradePoints / totalCredits;

      return {
        success: true,
        action: 'calculate',
        result: {
          gpa: Number(gpa.toFixed(3)),
          totalCredits,
          gradedCourses: gradedCourses.length,
          totalCourses: courses.length,
          courses: gradedCourses
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to calculate GPA'
      };
    }
  },

  showGPA() {
    try {
      const courses = this.getCourses();
      
      if (courses.length === 0) {
        return {
          success: true,
          action: 'show',
          courses: [],
          message: 'No courses added yet. Use /gpa add "Course Name" credits grade'
        };
      }

      const gradedCourses = courses.filter(c => c.grade && c.grade !== 'IP');
      const inProgressCourses = courses.filter(c => !c.grade || c.grade === 'IP');

      let gpa = null;
      if (gradedCourses.length > 0) {
        const totalCredits = gradedCourses.reduce((sum, course) => sum + course.credits, 0);
        const totalGradePoints = gradedCourses.reduce((sum, course) => sum + (course.gradePoints * course.credits), 0);
        gpa = Number((totalGradePoints / totalCredits).toFixed(3));
      }

      return {
        success: true,
        action: 'show',
        courses: {
          all: courses,
          graded: gradedCourses,
          inProgress: inProgressCourses,
          summary: {
            total: courses.length,
            graded: gradedCourses.length,
            inProgress: inProgressCourses.length,
            gpa
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve courses'
      };
    }
  },

  clearCourses() {
    try {
      this.saveCourses([]);
      return {
        success: true,
        action: 'clear',
        message: 'All courses cleared'
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to clear courses'
      };
    }
  },

  getGradePoints(grade) {
    const gradeMap = {
      'A+': 4.0, 'A': 4.0, 'A-': 3.7,
      'B+': 3.3, 'B': 3.0, 'B-': 2.7,
      'C+': 2.3, 'C': 2.0, 'C-': 1.7,
      'D+': 1.3, 'D': 1.0, 'D-': 0.7,
      'F': 0.0, 'IP': 0 // In Progress
    };
    
    return gradeMap[grade.toUpperCase()] || 0;
  },

  getCourses() {
    try {
      const stored = localStorage.getItem('aurora_gpa_courses');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  },

  saveCourses(courses) {
    try {
      localStorage.setItem('aurora_gpa_courses', JSON.stringify(courses));
    } catch (error) {
      console.error('Failed to save courses:', error);
    }
  }
};
